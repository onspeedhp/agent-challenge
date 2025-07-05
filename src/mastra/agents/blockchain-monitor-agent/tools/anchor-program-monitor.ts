import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { solanaRpcUrl } from '../../../config';
import {
  AnchorProgramResult,
  AnalysisResult,
  InstructionListResult,
  InstructionDetailsResult,
  PDAListResult,
  PDADataResult,
  InstructionInfo,
  AccountInfo,
  ErrorInfo,
  TypeInfo,
} from './types';
import {
  validateAndParseIdl,
  isValidSolanaAddress,
  derivePdaAddress,
  parsePdaSeeds,
} from './utils';

const connection = new Connection(solanaRpcUrl);

export const anchorProgramMonitor = createTool({
  id: 'anchor-program-monitor',
  description:
    'Advanced Anchor program analysis and monitoring tool with multiple operation modes',
  inputSchema: z.object({
    programId: z.string().describe('Program ID to analyze and fetch IDL from'),
    mode: z
      .enum([
        'analyze',
        'list-instructions',
        'instruction-details',
        'list-pdas',
        'fetch-pda',
      ])
      .describe(
        'Operation mode: analyze=full analysis, list-instructions=show instructions, instruction-details=specific instruction, list-pdas=show PDA structures, fetch-pda=fetch PDA data'
      ),
    instructionName: z
      .string()
      .optional()
      .nullable()
      .describe('Specific instruction name for instruction-details mode'),
    pdaAccountName: z
      .string()
      .optional()
      .nullable()
      .describe('PDA account name for fetch-pda mode'),
    seeds: z
      .array(z.string())
      .optional()
      .nullable()
      .describe('Seeds for PDA derivation in fetch-pda mode'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.any(),
    error: z.string().optional(),
    nextSteps: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    const { programId, mode, instructionName, pdaAccountName, seeds } = context;

    // Handle null values by converting to undefined
    const safeInstructionName = instructionName || undefined;
    const safePdaAccountName = pdaAccountName || undefined;
    const safeSeeds = seeds || undefined;
    try {
      // Validate program ID
      if (!isValidSolanaAddress(programId)) {
        return {
          success: false,
          error: 'Invalid Solana program ID format',
          nextSteps: [
            'Provide a valid base58 encoded Solana program ID (32-44 characters)',
          ],
        };
      }

      // Fetch IDL from the program
      let parsedIdl: any = null;
      try {
        console.log(`🔍 Fetching IDL for program: ${programId}`);
        console.log(`📡 Using RPC endpoint: ${solanaRpcUrl}`);
        
        parsedIdl = await anchor.Program.fetchIdl(new PublicKey(programId), {
          connection: connection,
        });

        if (!parsedIdl) {
          console.log(`❌ No IDL found for program: ${programId}`);
          return {
            success: false,
            error: 'No IDL found for this program ID',
            nextSteps: [
              'Ensure the program ID is correct and the program has a published IDL',
              'The program might not be an Anchor program or the IDL might not be on-chain',
              'Try checking if the program exists on the blockchain first',
            ],
          };
        }

        console.log(`✅ Successfully fetched IDL for program: ${parsedIdl.metadata?.name || 'Unknown'}`);
        console.log(`📊 IDL contains ${parsedIdl.instructions?.length || 0} instructions and ${parsedIdl.accounts?.length || 0} accounts`);
      } catch (error) {
        console.log('❌ IDL fetch error:', error);
        return {
          success: false,
          error: `Failed to fetch IDL: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          nextSteps: [
            'Verify the program ID is correct',
            'Ensure the program is an Anchor program with published IDL',
            'Check if the program exists on the specified network',
            'Try using a different RPC endpoint if connection issues persist',
          ],
        };
      }

      // Execute based on mode
      switch (mode) {
        case 'analyze':
          console.log(`📊 Starting comprehensive analysis for program: ${programId}`);
          const analysisResult = await analyzeProgram(parsedIdl, programId);
          console.log(`✅ Analysis complete, returning ${JSON.stringify(analysisResult).length} characters of data`);
          return analysisResult;

        case 'list-instructions':
          console.log(`📋 Listing instructions for program: ${programId}`);
          const instructionResult = await listInstructions(parsedIdl, programId);
          console.log(`✅ Instruction listing complete, returning ${JSON.stringify(instructionResult).length} characters of data`);
          return instructionResult;

        case 'instruction-details':
          if (!safeInstructionName) {
            return {
              success: false,
              error: 'instructionName is required for instruction-details mode',
              nextSteps: ['Provide the name of the instruction to analyze'],
            };
          }
          return await getInstructionDetails(
            parsedIdl,
            programId,
            safeInstructionName
          );

        case 'list-pdas':
          return await listPdaStructures(parsedIdl, programId);

        case 'fetch-pda':
          if (!safePdaAccountName) {
            return {
              success: false,
              error: 'pdaAccountName is required for fetch-pda mode',
              nextSteps: ['Provide the PDA account name to fetch'],
            };
          }
          return await fetchPdaData(
            parsedIdl,
            programId,
            safePdaAccountName,
            safeSeeds
          );

        default:
          return {
            success: false,
            error: 'Invalid mode specified',
            nextSteps: [
              'Use one of: analyze, list-instructions, instruction-details, list-pdas, fetch-pda',
            ],
          };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        nextSteps: ['Check your inputs and try again'],
      };
    }
  },
});

async function analyzeProgram(idl: any, programId?: string): Promise<any> {
  if (!idl) {
    console.log('❌ No IDL provided for analysis');
    return {
      success: false,
      error: 'IDL is required for full program analysis',
      nextSteps: ['Provide the Anchor IDL JSON for comprehensive analysis'],
    };
  }

  console.log(`🔍 Analyzing IDL for program: ${programId}`);
  console.log(`📋 IDL metadata: ${JSON.stringify(idl.metadata, null, 2)}`);

  // Basic program metadata
  const programInfo = {
    name: idl.metadata?.name || 'Unknown Program',
    version: idl.metadata?.version || 'Unknown Version',
    programId: programId || 'Not provided',
    description: idl.metadata?.description || 'No description available',
  };

  console.log(`📊 Program info: ${JSON.stringify(programInfo, null, 2)}`);
  console.log(`📋 Found ${idl.instructions?.length || 0} instructions`);
  console.log(`🗃️ Found ${idl.accounts?.length || 0} accounts`);
  console.log(`⚠️ Found ${idl.errors?.length || 0} errors`);
  console.log(`🏗️ Found ${idl.types?.length || 0} types`);

  // Enhanced instruction analysis
  const instructionAnalysis = (idl.instructions || []).map((inst: any) => ({
    name: inst.name,
    description: inst.docs?.join(' ') || 'No description available',
    discriminator: inst.discriminator || [],
    accountsRequired: inst.accounts?.length || 0,
    argumentsRequired: inst.args?.length || 0,
    accounts: (inst.accounts || []).map((acc: any) => ({
      name: acc.name,
      isMut: acc.isMut || false,
      isSigner: acc.isSigner || false,
      isOptional: acc.isOptional || false,
      docs: acc.docs?.join(' ') || 'No description',
    })),
    arguments: (inst.args || []).map((arg: any) => ({
      name: arg.name,
      type: typeof arg.type === 'string' ? arg.type : JSON.stringify(arg.type),
      docs: arg.docs?.join(' ') || 'No description',
    })),
  }));

  // Enhanced PDA account analysis
  const pdaAnalysis = (idl.accounts || []).map((acc: any) => ({
    name: acc.name,
    description: acc.docs?.join(' ') || 'No description available',
    discriminator: acc.discriminator || [],
    size: acc.type?.fields?.length || 0,
    fields: (acc.type?.fields || []).map((field: any) => ({
      name: field.name,
      type:
        typeof field.type === 'string'
          ? field.type
          : JSON.stringify(field.type),
      docs: field.docs?.join(' ') || 'No description',
    })),
  }));

  // Enhanced error analysis
  const errorAnalysis = (idl.errors || []).map((err: any) => ({
    code: err.code,
    name: err.name,
    message: err.msg,
    description: `Error ${err.code}: ${err.msg}`,
  }));

  // Enhanced type analysis
  const typeAnalysis = (idl.types || []).map((type: any) => ({
    name: type.name,
    kind: type.type?.kind || 'unknown',
    description: type.docs?.join(' ') || 'No description available',
    fields: type.type?.fields || [],
    variants: type.type?.variants || [],
  }));

  // Summary statistics
  const summary = {
    totalInstructions: instructionAnalysis.length,
    totalPDAAccounts: pdaAnalysis.length,
    totalErrors: errorAnalysis.length,
    totalCustomTypes: typeAnalysis.length,
    complexityScore: Math.min(
      10,
      Math.ceil((instructionAnalysis.length + pdaAnalysis.length) / 2)
    ),
  };

  const result = {
    type: 'comprehensive-analysis',
    programInfo,
    summary,
    
    // CRITICAL: These are INSTRUCTIONS (what the program CAN DO)
    INSTRUCTIONS: {
      title: `🔧 PROGRAM INSTRUCTIONS (${instructionAnalysis.length} total)`,
      description: "These are the functions/methods you can call on this program",
      count: instructionAnalysis.length,
      list: instructionAnalysis.map((inst: any, idx: number) => 
        `${idx + 1}. ${inst.name} - ${inst.description} (${inst.accountsRequired} accounts, ${inst.argumentsRequired} args)`
      ),
      detailed: instructionAnalysis,
    },
    
    // CRITICAL: These are PDA STRUCTURES (data storage accounts)
    PDA_ACCOUNTS: {
      title: `🗃️ PDA ACCOUNT STRUCTURES (${pdaAnalysis.length} total)`,
      description: "These are the data storage account types this program manages",
      count: pdaAnalysis.length,
      list: pdaAnalysis.map((pda: any, idx: number) => 
        `${idx + 1}. ${pda.name} - ${pda.description} (${pda.size} fields)`
      ),
      detailed: pdaAnalysis,
    },
    
    // CRITICAL: These are ERROR CODES
    ERROR_CODES: {
      title: `⚠️ CUSTOM ERROR CODES (${errorAnalysis.length} total)`,
      description: "These are the specific error codes this program can throw",
      count: errorAnalysis.length,
      list: errorAnalysis.map((err: any, idx: number) => 
        `${idx + 1}. ${err.name} (${err.code}) - ${err.message}`
      ),
      detailed: errorAnalysis,
    },
    
    // CRITICAL: These are CUSTOM TYPES
    CUSTOM_TYPES: {
      title: `🏗️ CUSTOM DATA TYPES (${typeAnalysis.length} total)`,
      description: "These are the custom data structures defined by this program",
      count: typeAnalysis.length,
      list: typeAnalysis.map((type: any, idx: number) => 
        `${idx + 1}. ${type.name} (${type.kind}) - ${type.description}`
      ),
      detailed: typeAnalysis,
    },
    
    SECURITY_ANALYSIS: {
      title: "🔒 SECURITY CONSIDERATIONS",
      notes: [
        `⚠️ ${instructionAnalysis.length} instructions available - each needs security review`,
        `🗃️ ${pdaAnalysis.length} PDA structures manage data - verify access controls`,
        `🚨 ${errorAnalysis.length} custom errors defined - important for error handling`,
        programInfo.name.toLowerCase().includes('wallet')
          ? '💰 WALLET PROGRAM DETECTED - Extra security caution required!'
          : '📋 Regular program - follow standard security practices',
      ],
      recommendations: [
        "🔍 Review each instruction's account requirements (mutable/signer)",
        "🔐 Verify PDA seed patterns for proper access control",
        "🧪 Test all instructions on devnet before mainnet",
        "📊 Monitor for unusual error patterns in production",
      ],
    },
  };

  console.log(`✅ Analysis complete for program: ${programInfo.name}`);
  console.log(`📊 Returning structured data with ${instructionAnalysis.length} instructions, ${pdaAnalysis.length} PDAs, ${errorAnalysis.length} errors`);
  
  const finalResult = {
    success: true,
    result,
    nextSteps: [
      `Review all ${instructionAnalysis.length} instructions for your use case`,
      `Examine ${pdaAnalysis.length} PDA account structures for data storage`,
      'Use instruction-details mode to get specific instruction information',
      'Use list-pdas mode for focused PDA structure analysis',
      'Use fetch-pda mode to retrieve actual PDA data',
      'Consider security implications of mutable accounts and signer requirements',
    ],
  };

  console.log(`🎯 Final result structure: ${Object.keys(finalResult.result).join(', ')}`);
  
  return finalResult;
}

async function listInstructions(idl: any, programId?: string): Promise<any> {
  if (!idl) {
    return {
      success: false,
      error: 'IDL is required to list instructions',
      nextSteps: ['Provide the Anchor IDL JSON'],
    };
  }

  const programName = idl.metadata?.name || 'Unknown Program';

  const instructionDetails = (idl.instructions || []).map(
    (inst: any, index: number) => ({
      index: index + 1,
      name: inst.name,
      description: inst.docs?.join(' ') || 'No description available',
      discriminator: inst.discriminator || [],
      complexity: (inst.accounts?.length || 0) + (inst.args?.length || 0),
      accounts: {
        total: inst.accounts?.length || 0,
        details: (inst.accounts || []).map((acc: any) => ({
          name: acc.name,
          isMut: acc.isMut || false,
          isSigner: acc.isSigner || false,
          isOptional: acc.isOptional || false,
          pda: acc.pda || null,
          description: acc.docs?.join(' ') || 'No description',
        })),
      },
      arguments: {
        total: inst.args?.length || 0,
        details: (inst.args || []).map((arg: any) => ({
          name: arg.name,
          type:
            typeof arg.type === 'string' ? arg.type : JSON.stringify(arg.type),
          description: arg.docs?.join(' ') || 'No description',
        })),
      },
    })
  );

  // Categorize instructions by complexity
  const categories = {
    simple: instructionDetails.filter((inst: any) => inst.complexity <= 3),
    moderate: instructionDetails.filter(
      (inst: any) => inst.complexity > 3 && inst.complexity <= 6
    ),
    complex: instructionDetails.filter((inst: any) => inst.complexity > 6),
  };

  const summary = {
    totalInstructions: instructionDetails.length,
    byComplexity: {
      simple: categories.simple.length,
      moderate: categories.moderate.length,
      complex: categories.complex.length,
    },
    mostComplex: instructionDetails.reduce(
      (max: any, inst: any) => (inst.complexity > max.complexity ? inst : max),
      instructionDetails[0] || { name: 'None', complexity: 0 }
    ),
  };

  const result = {
    type: 'detailed-instruction-list',
    programName,
    
    INSTRUCTION_SUMMARY: {
      title: `🔧 ALL PROGRAM INSTRUCTIONS (${instructionDetails.length} total)`,
      totalCount: instructionDetails.length,
      complexityBreakdown: {
        simple: `${categories.simple.length} simple instructions (≤3 complexity)`,
        moderate: `${categories.moderate.length} moderate instructions (4-6 complexity)`,
        complex: `${categories.complex.length} complex instructions (>6 complexity)`,
      },
      mostComplex: `Most complex: ${summary.mostComplex.name} (${summary.mostComplex.complexity} complexity)`,
    },
    
    INSTRUCTIONS_LIST: {
      title: "📋 COMPLETE INSTRUCTION LIST",
      instructions: instructionDetails.map((inst: any, idx: number) => ({
        number: idx + 1,
        name: inst.name,
        description: inst.description,
        complexity: inst.complexity,
        accountsRequired: inst.accounts.total,
        argumentsRequired: inst.arguments.total,
        summary: `${inst.name} - ${inst.description} (${inst.accounts.total} accounts, ${inst.arguments.total} args)`,
      })),
    },
    
    COMPLEXITY_CATEGORIES: {
      title: "🎯 INSTRUCTIONS BY COMPLEXITY",
      simple: {
        title: `✅ SIMPLE INSTRUCTIONS (${categories.simple.length} total)`,
        description: "Good for beginners, minimal parameters",
        list: categories.simple.map((inst: any) => `${inst.name} - ${inst.description}`),
      },
      moderate: {
        title: `⚠️ MODERATE INSTRUCTIONS (${categories.moderate.length} total)`,
        description: "Require careful parameter setup",
        list: categories.moderate.map((inst: any) => `${inst.name} - ${inst.description}`),
      },
      complex: {
        title: `🚨 COMPLEX INSTRUCTIONS (${categories.complex.length} total)`,
        description: "Advanced usage, many parameters",
        list: categories.complex.map((inst: any) => `${inst.name} - ${inst.description}`),
      },
    },
    
    RECOMMENDATIONS: {
      title: "💡 USAGE RECOMMENDATIONS",
      getting_started: [
        `Start with simple instructions (${categories.simple.length} available)`,
        'Always verify account permissions (mut/signer) before calling',
        'Test with devnet before mainnet interactions',
      ],
      advanced: categories.complex.length > 0 ? [
        `Complex instructions require careful parameter setup (${categories.complex.length} available)`,
        'Review account requirements thoroughly for complex instructions',
        'Consider using instruction-details mode for complex instructions',
      ] : ['No complex instructions in this program'],
    },
    
    // Keep detailed data for further analysis
    detailedInstructions: instructionDetails,
    summary,
    categories,
  };

  return {
    success: true,
    result,
    nextSteps: [
      `Review ${instructionDetails.length} instructions above`,
      'Use instruction-details mode for specific instruction analysis',
      'Choose appropriate instruction based on complexity level',
      'Consider starting with simple instructions for initial testing',
    ],
  };
}

async function getInstructionDetails(
  idl: any,
  programId: string | undefined,
  instructionName: string
): Promise<any> {
  if (!idl) {
    return {
      success: false,
      error: 'IDL is required to get instruction details',
      nextSteps: ['Provide the Anchor IDL JSON'],
    };
  }

  const instruction = idl.instructions?.find(
    (inst: any) => inst.name === instructionName
  );
  if (!instruction) {
    return {
      success: false,
      error: `Instruction '${instructionName}' not found in IDL`,
      nextSteps: ['Use list-instructions mode to see available instructions'],
    };
  }

  const result: InstructionDetailsResult = {
    type: 'instruction-details',
    instruction: {
      name: instruction.name,
      description: instruction.docs?.join(' ') || 'No description available',
      accounts: instruction.accounts || [],
      args: instruction.args || [],
      discriminator: instruction.discriminator || [],
    },
  };

  return {
    success: true,
    result,
    nextSteps: [
      'Collect the required account addresses and arguments',
      'Use this information to interact with the program',
    ],
  };
}

async function listPdaStructures(idl: any, programId?: string): Promise<any> {
  if (!idl) {
    return {
      success: false,
      error: 'IDL is required to list PDA structures',
      nextSteps: ['Provide the Anchor IDL JSON'],
    };
  }

  const programName = idl.metadata?.name || 'Unknown Program';

  const pdaStructures = (idl.accounts || []).map((acc: any, index: number) => ({
    index: index + 1,
    name: acc.name,
    description: acc.docs?.join(' ') || 'No description available',
    discriminator: acc.discriminator || [],
    fieldCount: acc.type?.fields?.length || 0,
    size:
      acc.type?.fields?.reduce((total: number, field: any) => {
        // Rough size estimation based on field types
        const fieldSize = getFieldSize(field.type);
        return total + fieldSize;
      }, 8) || 8, // 8 bytes for discriminator
    fields: (acc.type?.fields || []).map((field: any) => ({
      name: field.name,
      type:
        typeof field.type === 'string'
          ? field.type
          : JSON.stringify(field.type),
      size: getFieldSize(field.type),
      description: field.docs?.join(' ') || 'No description',
    })),
  }));

  // Categorize by complexity
  const categories = {
    simple: pdaStructures.filter((pda: any) => pda.fieldCount <= 5),
    moderate: pdaStructures.filter(
      (pda: any) => pda.fieldCount > 5 && pda.fieldCount <= 10
    ),
    complex: pdaStructures.filter((pda: any) => pda.fieldCount > 10),
  };

  const summary = {
    totalPDAStructures: pdaStructures.length,
    byComplexity: {
      simple: categories.simple.length,
      moderate: categories.moderate.length,
      complex: categories.complex.length,
    },
    totalFields: pdaStructures.reduce(
      (total: number, pda: any) => total + pda.fieldCount,
      0
    ),
    averageFieldsPerPDA:
      pdaStructures.length > 0
        ? Math.round(
            (pdaStructures.reduce(
              (total: number, pda: any) => total + pda.fieldCount,
              0
            ) /
              pdaStructures.length) *
              10
          ) / 10
        : 0,
  };

  const result = {
    type: 'detailed-pda-list',
    programName,
    
    PDA_SUMMARY: {
      title: `🗃️ ALL PDA ACCOUNT STRUCTURES (${pdaStructures.length} total)`,
      totalCount: pdaStructures.length,
      complexityBreakdown: {
        simple: `${categories.simple.length} simple structures (≤5 fields)`,
        moderate: `${categories.moderate.length} moderate structures (6-10 fields)`,
        complex: `${categories.complex.length} complex structures (>10 fields)`,
      },
      dataStats: {
        totalFields: summary.totalFields,
        averageFieldsPerPDA: summary.averageFieldsPerPDA,
      },
    },
    
    PDA_STRUCTURES_LIST: {
      title: "📋 COMPLETE PDA STRUCTURES LIST",
      structures: pdaStructures.map((pda: any, idx: number) => ({
        number: idx + 1,
        name: pda.name,
        description: pda.description,
        fieldCount: pda.fieldCount,
        estimatedSize: pda.size,
        summary: `${pda.name} - ${pda.description} (${pda.fieldCount} fields, ~${pda.size} bytes)`,
      })),
    },
    
    COMPLEXITY_CATEGORIES: {
      title: "🎯 PDA STRUCTURES BY COMPLEXITY",
      simple: {
        title: `✅ SIMPLE STRUCTURES (${categories.simple.length} total)`,
        description: "Basic data storage, ≤5 fields",
        list: categories.simple.map((pda: any) => `${pda.name} - ${pda.description} (${pda.fieldCount} fields)`),
      },
      moderate: {
        title: `⚠️ MODERATE STRUCTURES (${categories.moderate.length} total)`,
        description: "Medium complexity, 6-10 fields",
        list: categories.moderate.map((pda: any) => `${pda.name} - ${pda.description} (${pda.fieldCount} fields)`),
      },
      complex: {
        title: `🚨 COMPLEX STRUCTURES (${categories.complex.length} total)`,
        description: "Advanced data storage, >10 fields",
        list: categories.complex.map((pda: any) => `${pda.name} - ${pda.description} (${pda.fieldCount} fields)`),
      },
    },
    
    USAGE_GUIDANCE: {
      title: "💡 PDA USAGE GUIDANCE",
      recommendations: [
        `${pdaStructures.length} PDA structures available for data storage`,
        'Start with simple structures for basic data needs',
        'Consider data size limits when choosing PDA structures',
        'Each PDA requires specific seeds for address derivation',
      ],
      seedingGuidance: {
        title: "🔑 SEED PATTERN GUIDANCE",
        patterns: [
          'Most PDAs use predictable seeds like user pubkey + identifier',
          'Seeds determine the unique address of each PDA instance',
          'Common seed patterns: [b"prefix", user.key(), identifier]',
          'Always verify seed requirements before fetching PDA data',
        ],
        examples: [
          '[b"config"] - Global configuration PDA',
          '[user.key()] - User-specific account',
          '[b"vault", user.key(), mint.key()] - User token vault',
        ],
      },
    },
    
    // Keep detailed data for further analysis
    detailedPdaStructures: pdaStructures,
    summary,
    categories,
  };

  return {
    success: true,
    result,
    nextSteps: [
      `Review ${pdaStructures.length} PDA structures above`,
      'Use fetch-pda mode to retrieve specific PDA data',
      'Prepare appropriate seeds for PDA derivation',
      'Consider data requirements when choosing PDA structures',
    ],
  };
}

// Helper function to estimate field sizes
function getFieldSize(fieldType: any): number {
  if (typeof fieldType === 'string') {
    switch (fieldType) {
      case 'bool':
        return 1;
      case 'u8':
      case 'i8':
        return 1;
      case 'u16':
      case 'i16':
        return 2;
      case 'u32':
      case 'i32':
        return 4;
      case 'u64':
      case 'i64':
        return 8;
      case 'u128':
      case 'i128':
        return 16;
      case 'f32':
        return 4;
      case 'f64':
        return 8;
      case 'publicKey':
        return 32;
      case 'string':
        return 32; // Estimated average
      default:
        return 8; // Default estimate
    }
  } else if (fieldType && typeof fieldType === 'object') {
    if (fieldType.vec) return 32; // Vector estimated
    if (fieldType.option) return getFieldSize(fieldType.option) + 1;
    if (fieldType.array)
      return getFieldSize(fieldType.array[0]) * (fieldType.array[1] || 1);
  }
  return 8; // Default estimate
}

async function fetchPdaData(
  idl: any,
  programId: string | undefined,
  pdaAccountName: string,
  seeds?: string[]
): Promise<any> {
  if (!idl) {
    return {
      success: false,
      error: 'IDL is required to fetch PDA data',
      nextSteps: ['Provide the Anchor IDL JSON'],
    };
  }

  if (!programId) {
    return {
      success: false,
      error: 'Program ID is required to fetch PDA data',
      nextSteps: ['Provide the program ID for PDA derivation'],
    };
  }

  const accountStruct = idl.accounts?.find(
    (acc: any) => acc.name === pdaAccountName
  );
  if (!accountStruct) {
    return {
      success: false,
      error: `PDA account '${pdaAccountName}' not found in IDL`,
      nextSteps: ['Use list-pdas mode to see available PDA structures'],
    };
  }

  try {
    // If seeds are provided, derive PDA address
    let pdaAddress: string | null = null;
    if (seeds && seeds.length > 0) {
      const seedBuffers = seeds.map((seed) => Buffer.from(seed, 'utf8'));
      const [derivedPda] = PublicKey.findProgramAddressSync(
        seedBuffers,
        new PublicKey(programId)
      );
      pdaAddress = derivedPda.toBase58();
    }

    const result: PDADataResult = {
      type: 'pda-data',
      accountData: {
        address: pdaAddress || 'No address derived - provide seeds',
        struct: pdaAccountName,
        exists: false,
        data: {
          note: pdaAddress
            ? 'PDA address derived successfully'
            : 'Provide seeds to derive PDA address',
        },
      },
    };

    // If we have a PDA address, try to fetch account data
    if (pdaAddress) {
      try {
        const accountInfo = await connection.getAccountInfo(
          new PublicKey(pdaAddress)
        );
        if (accountInfo) {
          result.accountData.exists = true;
          result.accountData.data = {
            raw: accountInfo.data.toString('base64'),
            lamports: accountInfo.lamports,
            owner: accountInfo.owner.toBase58(),
            parsed: 'Use appropriate deserializer for structured data',
          };
        }
      } catch (error) {
        result.accountData.data = {
          ...result.accountData.data,
          note: 'Failed to fetch account data from blockchain',
        };
      }
    }

    return {
      success: true,
      result,
      nextSteps: pdaAddress
        ? [
            'Account data retrieved successfully',
            'Use appropriate deserializer to parse the raw data',
          ]
        : [
            'Provide seeds to derive the PDA address',
            "Ensure seeds match the program's PDA derivation logic",
          ],
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch PDA data',
      nextSteps: ['Check the provided seeds and program ID'],
    };
  }
}
