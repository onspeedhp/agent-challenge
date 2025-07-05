import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { model, solanaRpcUrl } from '../../config';
import { isValidSolanaAddress } from './tools/utils';

// Create a blockchain monitor agent for the workflow
const blockchainAgent = new Agent({
  name: 'Blockchain Monitor Agent',
  model,
  instructions: `
    You are a Solana blockchain monitoring specialist focused on Anchor program analysis.
    
    Analyze IDL structures and provide clear, structured guidance for blockchain interactions.
    
    When responding:
    - Use clear, structured formatting with emojis
    - Explain technical concepts in accessible terms
    - Provide specific next steps and recommendations
    - Include security considerations
    
    Always provide actionable insights for blockchain development.
  `,
});

// IDL analysis result schema
const idlAnalysisSchema = z.object({
  programName: z.string(),
  instructionCount: z.number(),
  pdaCount: z.number(),
  analysis: z.string(),
  recommendations: z.string(),
});

// Step 1: Analyze Program
const analyzeProgramStep = createStep({
  id: 'analyze-program',
  description: 'Fetch and analyze the Anchor program IDL',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID to analyze'),
    userChoice: z
      .enum(['interact', 'fetch-pda'])
      .optional()
      .describe("User's choice for next action"),
  }),
  outputSchema: idlAnalysisSchema,
      execute: async ({ inputData }) => {
      if (!inputData.programId) {
        throw new Error('Program ID is required for analysis');
      }

      // Validate program ID format
      if (!isValidSolanaAddress(inputData.programId)) {
        throw new Error('Invalid Solana program ID format');
      }

      // Fetch IDL directly using anchor.Program.fetchIdl
      let parsedIdl: any;
      try {
        console.log(`Fetching IDL for program: ${inputData.programId}`);
        
        const connection = new Connection(solanaRpcUrl);
        parsedIdl = await anchor.Program.fetchIdl(new PublicKey(inputData.programId), {
          connection: connection,
        });

        if (!parsedIdl) {
          throw new Error('No IDL found for this program ID. The program might not be an Anchor program or the IDL might not be published on-chain.');
        }

        console.log(`Successfully fetched IDL for program: ${parsedIdl.metadata?.name || 'Unknown'}`);
      } catch (error) {
        throw new Error(
          `Failed to fetch IDL: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }

    // Extract program name from various possible locations
    const programName =
      parsedIdl.metadata?.name ||
      parsedIdl.name ||
      parsedIdl.programName ||
      'Unknown Program';
    const instructions = parsedIdl.instructions || [];
    const accounts = parsedIdl.accounts || [];
    const errors = parsedIdl.errors || [];
    const types = parsedIdl.types || [];

    const instructionCount = instructions.length;
    const pdaCount = accounts.length;
    const errorCount = errors.length;
    const typeCount = types.length;

    // Generate analysis using the agent
    const analysisPrompt = `
      Analyze this Anchor program IDL:
      
      **Program Name:** ${programName}
      **Program Address:** ${parsedIdl.address || 'Not specified'}
      **Version:** ${parsedIdl.metadata?.version || 'Unknown'}
      **Description:** ${
        parsedIdl.metadata?.description ||
        parsedIdl.docs?.join(' ') ||
        'No description provided'
      }
      
      **Statistics:**
      - Instructions: ${instructionCount} available
      - PDA Account Structures: ${pdaCount} defined  
      - Error Codes: ${errorCount} defined
      - Custom Types: ${typeCount} defined
      
      **Instruction Names:** ${
        instructions.map((i: any) => i.name).join(', ') || 'None'
      }
      **PDA Account Names:** ${
        accounts.map((a: any) => a.name).join(', ') || 'None'
      }
      **Error Types:** ${errors
        .slice(0, 5)
        .map((e: any) => e.name)
        .join(', ')}${errors.length > 5 ? '...' : ''}
      
      Provide a comprehensive analysis in this format:
      
      ## 🔍 Program Analysis: ${programName}
      [Brief overview of the program's purpose and capabilities based on the description and structure]
      
      ## 📋 Key Features
      **Instructions:** [Explain what the main instructions do and their purpose]
      **PDA Accounts:** [Explain the data structures and their purpose in the program]
      **Error Handling:** [Comment on the error handling strategy if errors are defined]
      
      ## 💡 Development Insights
      [Technical insights about program architecture, security patterns, and design choices]
      
      ## 🚀 Recommended Next Steps
      [Specific actionable recommendations for developers working with this program]
    `;

    const analysisResponse = await blockchainAgent.stream([
      {
        role: 'user',
        content: analysisPrompt,
      },
    ]);

    let analysis = '';
    for await (const chunk of analysisResponse.textStream) {
      analysis += chunk;
    }

    // Generate recommendations based on user choice
    const recommendationsPrompt = `
      Based on the program analysis, provide specific recommendations for:
      ${
        inputData.userChoice === 'interact'
          ? 'program instruction interaction'
          : inputData.userChoice === 'fetch-pda'
          ? 'PDA data fetching'
          : 'general development'
      }
      
      Format as a concise bulleted list of 3-5 actionable steps.
    `;

    const recommendationsResponse = await blockchainAgent.stream([
      {
        role: 'user',
        content: recommendationsPrompt,
      },
    ]);

    let recommendations = '';
    for await (const chunk of recommendationsResponse.textStream) {
      recommendations += chunk;
    }

    return {
      programName,
      instructionCount,
      pdaCount,
      analysis,
      recommendations,
    };
  },
});

// Step 2: Generate final guidance
const generateGuidanceStep = createStep({
  id: 'generate-guidance',
  description: 'Generate final guidance based on IDL analysis',
  inputSchema: idlAnalysisSchema,
  outputSchema: z.object({
    finalReport: z.string(),
    nextSteps: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const {
      programName,
      instructionCount,
      pdaCount,
      analysis,
      recommendations,
    } = inputData;

    // Generate final comprehensive report
    const reportPrompt = `
      Create a final comprehensive report based on:
      
      **Program:** ${programName}
      **Statistics:** ${instructionCount} instructions, ${pdaCount} PDA structures
      **Analysis:** ${analysis}
      **Recommendations:** ${recommendations}
      
      Generate a complete blockchain monitoring report that includes:
      
      ## ✅ Blockchain Monitor Report: ${programName}
      
      ### 📊 Program Overview
      [Summary of program capabilities and architecture]
      
      ### 🔧 Technical Analysis
      [Key technical insights and findings]
      
      ### 🎯 Implementation Guidance
      [Specific guidance for developers]
      
      ### ⚡ Quick Start Steps
      [Immediate next steps to get started]
      
      ### 🔐 Security Considerations
      [Important security and best practice notes]
    `;

    const reportResponse = await blockchainAgent.stream([
      {
        role: 'user',
        content: reportPrompt,
      },
    ]);

    let finalReport = '';
    for await (const chunk of reportResponse.textStream) {
      finalReport += chunk;
    }

    // Extract next steps
    const nextSteps = [
      "Review the program's instruction documentation",
      'Set up development environment with Anchor CLI',
      'Identify key accounts and their relationships',
      'Plan interaction workflow and error handling',
      'Implement comprehensive testing strategy',
    ];

    return {
      finalReport,
      nextSteps,
    };
  },
});

// Create the main workflow
const blockchainMonitorWorkflow = createWorkflow({
  id: 'blockchain-monitor-workflow',
  inputSchema: z.object({
    programId: z
      .string()
      .describe(
        'Solana program ID to analyze (IDL will be fetched automatically)'
      ),
    userChoice: z
      .enum(['interact', 'fetch-pda'])
      .optional()
      .describe("User's choice for analysis focus"),
  }),
  outputSchema: z.object({
    finalReport: z.string(),
    nextSteps: z.array(z.string()),
  }),
})
  .then(analyzeProgramStep)
  .then(generateGuidanceStep);

// Commit the workflow
blockchainMonitorWorkflow.commit();

export { blockchainMonitorWorkflow };
