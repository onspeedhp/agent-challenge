import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

// Import agents following the stock agent pattern
import { solanaExpertAgent } from './agents/blockchain-monitor-agent/solana-expert-agent';
import { blockchainMonitorWorkflow } from './agents/blockchain-monitor-agent/blockchain-monitor-workflow';

export const mastra = new Mastra({
  agents: {
    solanaExpertAgent,
  },
  workflows: {
    blockchainMonitorWorkflow,
  },
  logger: new PinoLogger({
    name: 'Solana Blockchain Monitor',
    level: 'info',
  }),
  server: {
    port: 8080,
    timeout: 10000,
  },
});
