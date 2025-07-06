import { Mastra } from '@mastra/core';
import { solanaProgramAgent } from './agents/blockchain-monitor-agent/agent';
import { PinoLogger } from '@mastra/loggers';

export const mastra = new Mastra({
  agents: { solanaProgramAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    port: 8080,
    timeout: 10000,
  },
});
