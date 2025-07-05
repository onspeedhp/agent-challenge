import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import { solanaRpcUrl } from '../../../config';
import { SolanaTransaction } from './types';
import { getProgramName, isValidSolanaAddress } from './utils';

export const solanaTxMonitorTool = createTool({
  id: 'solana-tx-monitor',
  description:
    'Monitor Solana transactions with advanced filtering and analysis',
  inputSchema: z.object({
    address: z.string().describe('Solana wallet address to monitor'),
    limit: z
      .number()
      .optional()
      .describe('Number of transactions to retrieve')
      .default(20),
    programFilter: z
      .string()
      .optional()
      .describe('Filter by specific program ID'),
    includeTokenTransfers: z
      .boolean()
      .optional()
      .describe('Include token transfer analysis')
      .default(true),
    timeRange: z
      .enum(['1h', '6h', '24h', '7d'])
      .optional()
      .describe('Time range for analysis')
      .default('24h'),
  }),
  outputSchema: z.object({
    address: z.string(),
    transactions: z.array(
      z.object({
        signature: z.string(),
        slot: z.number(),
        blockTime: z.number(),
        fee: z.number(),
        status: z.enum(['confirmed', 'finalized', 'processed']),
        programInstructions: z.array(
          z.object({
            programId: z.string(),
            programName: z.string(),
            instruction: z.string(),
          })
        ),
        balanceChanges: z.array(
          z.object({
            account: z.string(),
            before: z.number(),
            after: z.number(),
            change: z.number(),
          })
        ),
        tokenTransfers: z.array(
          z.object({
            mint: z.string(),
            from: z.string(),
            to: z.string(),
            amount: z.number(),
            decimals: z.number(),
          })
        ),
      })
    ),
    analytics: z.object({
      totalTransactions: z.number(),
      totalFees: z.number(),
      programInteractions: z.record(z.number()),
      averageTransactionSize: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { address, limit, programFilter, includeTokenTransfers, timeRange } =
      context;

    // Validate Solana address format
    if (!isValidSolanaAddress(address)) {
      throw new Error('Invalid Solana address format');
    }

    try {
      // Create connection to Solana devnet
      const connection = new Connection(solanaRpcUrl, 'confirmed');
      const publicKey = new PublicKey(address);

      // Get transaction signatures
      const signatures = await connection.getSignaturesForAddress(publicKey, {
        limit: limit || 20,
      });

      if (signatures.length === 0) {
        return {
          address,
          transactions: [],
          analytics: {
            totalTransactions: 0,
            totalFees: 0,
            programInteractions: {},
            averageTransactionSize: 0,
          },
        };
      }

      // Fetch transaction details
      const transactions: any[] = [];
      const programInteractions: Record<string, number> = {};
      let totalFees = 0;

      // Process transactions in batches to avoid rate limits
      for (let i = 0; i < signatures.length; i += 5) {
        const batch = signatures.slice(i, i + 5);
        const batchTransactions = await Promise.all(
          batch.map(async (sig) => {
            try {
              const tx = await connection.getTransaction(sig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });

              if (!tx) return null;

              // Extract program instructions
              const programInstructions =
                tx.transaction.message.compiledInstructions.map(
                  (instruction, index) => {
                    const programId =
                      tx.transaction.message.staticAccountKeys[
                        instruction.programIdIndex
                      ];
                    return {
                      programId: programId.toBase58(),
                      programName: getProgramName(programId.toBase58()),
                      instruction: `Instruction ${index}`,
                    };
                  }
                );

              // Update program interactions count
              programInstructions.forEach((inst: any) => {
                programInteractions[inst.programName] =
                  (programInteractions[inst.programName] || 0) + 1;
              });

              // Calculate balance changes
              const balanceChanges =
                tx.meta?.preBalances.map(
                  (preBalance: number, index: number) => {
                    const postBalance = tx.meta?.postBalances[index] || 0;
                    const change = postBalance - preBalance;
                    return {
                      account:
                        tx.transaction.message.staticAccountKeys[
                          index
                        ]?.toBase58() || '',
                      before: preBalance,
                      after: postBalance,
                      change: change,
                    };
                  }
                ) || [];

              totalFees += tx.meta?.fee || 0;

              return {
                signature: sig.signature,
                slot: sig.slot || 0,
                blockTime: sig.blockTime || 0,
                fee: tx.meta?.fee || 0,
                status: sig.confirmationStatus || 'confirmed',
                programInstructions,
                balanceChanges,
                tokenTransfers: [], // Token transfers would need additional parsing
              };
            } catch (error) {
              console.warn(
                `Failed to fetch transaction ${sig.signature}:`,
                error
              );
              return null;
            }
          })
        );

        transactions.push(...batchTransactions.filter((tx) => tx !== null));
      }

      // Filter by program if specified
      let filteredTransactions = transactions;
      if (programFilter) {
        filteredTransactions = transactions.filter((tx: any) =>
          tx.programInstructions.some(
            (inst: any) => inst.programId === programFilter
          )
        );
      }

      // Calculate analytics
      const averageTransactionSize =
        filteredTransactions.length > 0
          ? filteredTransactions.reduce((sum: number, tx: any) => {
              const totalChange = tx.balanceChanges.reduce(
                (changeSum: number, change: any) =>
                  changeSum + Math.abs(change.change),
                0
              );
              return sum + totalChange;
            }, 0) / filteredTransactions.length
          : 0;

      return {
        address,
        transactions: filteredTransactions,
        analytics: {
          totalTransactions: filteredTransactions.length,
          totalFees,
          programInteractions,
          averageTransactionSize,
        },
      };
    } catch (error) {
      console.error('Error fetching Solana transactions:', error);
      throw new Error(
        `Failed to fetch Solana transactions: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});
