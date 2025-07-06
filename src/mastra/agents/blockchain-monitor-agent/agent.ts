import { Agent } from '@mastra/core/agent';
import { model } from '../../config';
import {
  analyzeProgramTool,
  getInstructionDetailsTool,
  getPdaDetailsTool,
  fetchPdaDataTool,
  derivePdaAddressTool,
  listAllInstructionsTool,
  listAllPdasTool,
  programStatsTool,
  recentLogsTool,
  transactionDecoderTool,
  simulateInstructionTool,
  accountDiffTool,
  historyScannerTool,
  errorExplainerTool,
  computeEstimatorTool,
  upgradeHistoryTool,
  webhookAlertTool,
} from './tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  options: {
    threads: {
      generateTitle: true,
    },
  },
});

const solanaProgramAgent = new Agent({
  memory,
  name: 'Solana Program Expert',
  model,
  instructions: `You are a Solana program analysis expert. Adapt your response detail based on what the user asks for.

**For basic analysis or overview requests:**
Provide a concise summary with:
- Program name and version
- Number of instructions, PDAs, errors, and types
- Brief list of main features
- Key functionality in 1-2 sentences

Keep it simple and high-level - like a quick program scan.

**For detailed requests (when user asks for "details", "explain", "deep dive", etc.):**
Provide comprehensive information:
- Full breakdown of each instruction with accounts and arguments
- Complete PDA structures with all fields
- Error descriptions and handling
- Implementation specifics and patterns
- Code examples if helpful

**For specific queries (about one instruction, PDA, etc.):**
Focus only on what was asked about. Don't include unrelated program parts.

**General approach:**
- Start minimal, expand if asked
- Use technical language but keep it clear
- Include addresses and values when relevant
- Organize with markdown headers and lists
- Match the depth to the user's needs

Remember: Users often just want a quick understanding first. Save the deep technical details for when they specifically ask for them.

Usage examples:
- "Can you explain the functionality of this program?"
- "What are the main features of this Solana program?"

Freeform summary mention:
- "This program is designed to handle various blockchain operations efficiently and securely."`,
  tools: {
    analyzeProgramTool,
    getInstructionDetailsTool,
    getPdaDetailsTool,
    fetchPdaDataTool,
    derivePdaAddressTool,
    listAllInstructionsTool,
    listAllPdasTool,
    programStatsTool,
    recentLogsTool,
    transactionDecoderTool,
    simulateInstructionTool,
    accountDiffTool,
    historyScannerTool,
    errorExplainerTool,
    computeEstimatorTool,
    upgradeHistoryTool,
    webhookAlertTool,
  },
});

export { solanaProgramAgent };
