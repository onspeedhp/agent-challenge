import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { solanaProgramAgent } from './agent';

// Simple program analysis step
const analyzeStep = createStep({
  id: 'analyze-program',
  description: 'Analyzing Solana program structure',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID to analyze'),
  }),
  outputSchema: z.object({
    analysis: z.string(),
    status: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { programId } = inputData;

    // Use the agent to analyze the program
    const analysisPrompt = `Analyze program ${programId} - provide a concise overview with key statistics only.`;

    const response = await solanaProgramAgent.generate([
      { role: 'user', content: analysisPrompt },
    ]);

    return {
      analysis: response.text,
      status: '✓ Program analysis complete',
    };
  },
});

// Simple instruction details step
const instructionStep = createStep({
  id: 'instruction-details',
  description: 'Getting instruction details',
  inputSchema: z.object({
    programId: z.string(),
    instructionName: z.string(),
  }),
  outputSchema: z.object({
    details: z.string(),
    status: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { programId, instructionName } = inputData;

    const prompt = `Show details for instruction '${instructionName}' in program ${programId}`;

    const response = await solanaProgramAgent.generate([
      { role: 'user', content: prompt },
    ]);

    return {
      details: response.text,
      status: '✓ Instruction details loaded',
    };
  },
});

// Main workflow
export const programAnalysisWorkflow = createWorkflow({
  id: 'program-analysis-workflow',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID to analyze'),
  }),
  outputSchema: z.object({
    analysis: z.string(),
    status: z.string(),
  }),
}).then(analyzeStep);

programAnalysisWorkflow.commit();

export { analyzeStep, instructionStep };
