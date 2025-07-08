import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { solanaRpcUrl } from '../../../config';
import { isValidSolanaAddress } from './utils';

const connection = new Connection(solanaRpcUrl);

// Helper: find struct/type definition for a given account/struct name
const findTypeDef = (idl: any, name: string) => {
  return (idl?.types || []).find((t: any) => t.name === name);
};

const getFieldsForAccount = (idl: any, acc: any): any[] => {
  let fields = acc?.type?.fields || [];
  if ((!fields || fields.length === 0) && idl?.types) {
    const typeDef = findTypeDef(idl, acc.name);
    if (typeDef?.type?.fields) {
      fields = typeDef.type.fields;
    }
  }
  return fields || [];
};

// 1. Program Summary Tool - Keep this as it's essential for overview
export const analyzeProgramTool = createTool({
  id: 'analyze-program',
  description: 'Get focused program summary with key information',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID to analyze'),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe('Maximum number of items to show per section (default 5)'),
  }),
  execute: async ({ context }) => {
    const { programId, limit = 5 } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error(
          "No IDL found for this program - ensure it's an Anchor program"
        );
      }

      return {
        name: idl.metadata?.name || 'Unknown Program',
        version: idl.metadata?.version || '1.0.0',
        programId: `${programId.slice(0, 4)}...${programId.slice(-4)}`,
        fullProgramId: programId,
        description: idl.metadata?.description || 'No description available',
        stats: {
          instructions: idl.instructions?.length || 0,
          accounts: idl.accounts?.length || 0,
          errors: idl.errors?.length || 0,
          types: idl.types?.length || 0,
        },
        instructions: (idl.instructions || [])
          .slice(0, limit)
          .map((inst: any) => ({
            name: inst.name,
            description: (inst.docs?.join(' ') || 'No description')
              .split(' ')
              .slice(0, 8)
              .join(' '),
            accountCount: inst.accounts?.length || 0,
            argCount: inst.args?.length || 0,
          })),
        accounts: (idl.accounts || []).slice(0, limit).map((acc: any) => {
          const fields = getFieldsForAccount(idl, acc);
          return {
            name: acc.name,
            description: ((acc as any).docs?.join(' ') || 'No description')
              .split(' ')
              .slice(0, 6)
              .join(' '),
            fieldCount: fields.length,
          };
        }),
        hasMore: {
          instructions: (idl.instructions?.length || 0) > limit,
          accounts: (idl.accounts?.length || 0) > limit,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to analyze program: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 2. Instruction Details Tool - Keep this for understanding instructions
export const getInstructionDetailsTool = createTool({
  id: 'get-instruction-details',
  description: 'Get detailed instruction information',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    instructionName: z.string().describe('Name of the instruction to analyze'),
  }),
  execute: async ({ context }) => {
    const { programId, instructionName } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const instruction = idl.instructions?.find(
        (inst: any) => inst.name === instructionName
      );
      if (!instruction) {
        throw new Error(`Instruction '${instructionName}' not found`);
      }

      return {
        name: instruction.name,
        description: instruction.docs?.join(' ') || 'No description available',
        accounts: (instruction.accounts || []).map((acc: any, idx: number) => ({
          index: idx,
          name: acc.name,
          writable: acc.isMut ? 'Yes' : 'No',
          signer: acc.isSigner ? 'Yes' : 'No',
          optional: acc.isOptional ? 'Yes' : 'No',
          description: (acc.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 8)
            .join(' '),
        })),
        args: (instruction.args || []).map((arg: any) => ({
          name: arg.name,
          type: typeof arg.type === 'string' ? arg.type : 'Object',
          description: (arg.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 6)
            .join(' '),
        })),
        counts: {
          accounts: (instruction.accounts || []).length,
          args: (instruction.args || []).length,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to get instruction details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 3. Account Structure Details Tool - Keep this for understanding PDA structures
export const getAccountDetailsTool = createTool({
  id: 'get-account-details',
  description: 'Get account structure details',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    accountName: z
      .string()
      .describe('Name of the account structure to analyze'),
  }),
  execute: async ({ context }) => {
    const { programId, accountName } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const accountStruct = idl.accounts?.find(
        (acc: any) => acc.name === accountName
      );
      if (!accountStruct) {
        throw new Error(`Account structure '${accountName}' not found`);
      }

      let fields = (accountStruct as any).type?.fields || [];
      if ((!fields || fields.length === 0) && idl.types) {
        const typeDef = findTypeDef(idl, accountStruct.name);
        if (typeDef?.type?.fields) {
          fields = typeDef.type.fields;
        }
      }

      return {
        name: accountStruct.name,
        description:
          (accountStruct as any).docs?.join(' ') || 'No description available',
        discriminator: (accountStruct as any).discriminator || [],
        fields: (fields || []).map((field: any) => ({
          name: field.name,
          type:
            typeof field.type === 'string'
              ? field.type
              : JSON.stringify(field.type),
          description: (field.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 6)
            .join(' '),
        })),
        info: {
          fieldCount: fields.length,
          size: (accountStruct as any).type?.size || 'Variable',
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to get account details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 4. Fetch Single Account Data Tool - Standard program.account.fetch() pattern
export const fetchAccountDataTool = createTool({
  id: 'fetch-account-data',
  description:
    'Fetch single account data using program.account.fetch() pattern',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    accountName: z.string().describe('Name of the account structure'),
    accountAddress: z.string().describe('The account address to fetch'),
  }),
  execute: async ({ context }) => {
    const { programId, accountName, accountAddress } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    if (!isValidSolanaAddress(accountAddress)) {
      throw new Error('Invalid account address format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const program = new anchor.Program(idl as anchor.Idl, { connection });

      // Find account structure in IDL (case-insensitive search)
      const accountStruct = idl.accounts?.find(
        (acc: any) => acc.name.toLowerCase() === accountName.toLowerCase()
      );
      if (!accountStruct) {
        const availableAccounts = (idl.accounts || []).map(
          (acc: any) => acc.name
        );
        throw new Error(
          `Account structure '${accountName}' not found in IDL. Available accounts: ${availableAccounts.join(
            ', '
          )}`
        );
      }

      // Convert account name to camelCase (Anchor convention) - use the actual IDL name
      const camelCaseAccountName =
        accountStruct.name.charAt(0).toLowerCase() +
        accountStruct.name.slice(1);

      // Fetch account data using Anchor's typed fetch
      const accountData = await (program.account as any)[
        camelCaseAccountName
      ].fetch(new PublicKey(accountAddress));

      return {
        address: accountAddress,
        accountType: accountName,
        data: accountData,
        success: true,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch account data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 5. Fetch All Accounts of Type Tool - Get all accounts of a specific structure
export const fetchAllAccountsTool = createTool({
  id: 'fetch-all-accounts',
  description:
    'Fetch all accounts of a specific type using program.account.all()',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    accountName: z.string().describe('Name of the account structure'),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe('Maximum number of accounts to fetch (default 50)'),
  }),
  execute: async ({ context }) => {
    const { programId, accountName, limit = 50 } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const program = new anchor.Program(idl as anchor.Idl, { connection });

      // Find account structure in IDL (case-insensitive search)
      const accountStruct = idl.accounts?.find(
        (acc: any) => acc.name.toLowerCase() === accountName.toLowerCase()
      );
      if (!accountStruct) {
        const availableAccounts = (idl.accounts || []).map(
          (acc: any) => acc.name
        );
        throw new Error(
          `Account structure '${accountName}' not found in IDL. Available accounts: ${availableAccounts.join(
            ', '
          )}`
        );
      }

      // Convert account name to camelCase (Anchor convention) - use the actual IDL name
      const camelCaseAccountName =
        accountStruct.name.charAt(0).toLowerCase() +
        accountStruct.name.slice(1);

      // Fetch all accounts of this type
      const accounts = await (program.account as any)[
        camelCaseAccountName
      ].all();

      return {
        accountType: accountName,
        totalFound: accounts.length,
        accounts: accounts.slice(0, limit).map((acc: any) => ({
          address: acc.publicKey.toBase58(),
          data: acc.account,
        })),
        hasMore: accounts.length > limit,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch all accounts: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 6. Fetch Accounts by Filter Tool - Filter accounts based on field values
export const fetchAccountsByFilterTool = createTool({
  id: 'fetch-accounts-by-filter',
  description:
    'Fetch accounts filtered by specific field values using memcmp filters',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    accountName: z.string().describe('Name of the account structure'),
    filters: z
      .array(
        z.object({
          field: z.string().describe('Field name to filter by'),
          value: z
            .union([z.string(), z.number(), z.boolean()])
            .describe('Value to match'),
        })
      )
      .describe('Array of field filters'),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe('Maximum number of accounts to fetch (default 20)'),
  }),
  execute: async ({ context }) => {
    const { programId, accountName, filters, limit = 20 } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const program = new anchor.Program(idl as anchor.Idl, { connection });

      // Find account structure in IDL (case-insensitive search)
      const accountStruct = idl.accounts?.find(
        (acc: any) => acc.name.toLowerCase() === accountName.toLowerCase()
      );
      if (!accountStruct) {
        const availableAccounts = (idl.accounts || []).map(
          (acc: any) => acc.name
        );
        throw new Error(
          `Account structure '${accountName}' not found in IDL. Available accounts: ${availableAccounts.join(
            ', '
          )}`
        );
      }

      // Convert account name to camelCase (Anchor convention) - use the actual IDL name
      const camelCaseAccountName =
        accountStruct.name.charAt(0).toLowerCase() +
        accountStruct.name.slice(1);

      // Get all accounts first, then filter (simple approach)
      const allAccounts = await (program.account as any)[
        camelCaseAccountName
      ].all();

      // Apply filters
      const filteredAccounts = allAccounts.filter((acc: any) => {
        return filters.every((filter) => {
          const fieldValue = acc.account[filter.field];
          if (fieldValue === undefined) return false;

          // Handle different value types
          if (typeof fieldValue === 'object' && fieldValue !== null) {
            // For PublicKey objects
            if (fieldValue.toBase58) {
              return fieldValue.toBase58() === filter.value;
            }
            // For BN objects
            if (fieldValue.toString) {
              return fieldValue.toString() === filter.value.toString();
            }
          }

          return fieldValue === filter.value;
        });
      });

      return {
        accountType: accountName,
        filters: filters,
        totalMatched: filteredAccounts.length,
        accounts: filteredAccounts.slice(0, limit).map((acc: any) => ({
          address: acc.publicKey.toBase58(),
          data: acc.account,
        })),
        hasMore: filteredAccounts.length > limit,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch filtered accounts: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 7. Derive PDA Address Tool - Keep this as it's very useful
export const derivePdaAddressTool = createTool({
  id: 'derive-pda-address',
  description: 'Derive PDA address from seeds',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    seeds: z
      .array(z.string())
      .describe('Array of seeds to derive the PDA address'),
  }),
  execute: async ({ context }) => {
    const { programId, seeds } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    if (!seeds || seeds.length === 0) {
      throw new Error('At least one seed is required for PDA derivation');
    }

    try {
      // Process seeds with type detection
      const processedSeeds = seeds.map((seed, index) => {
        let seedBuffer: Buffer;
        let seedType: string;

        if (seed.startsWith('0x')) {
          // Hexadecimal seed
          seedBuffer = Buffer.from(seed.slice(2), 'hex');
          seedType = 'Hex';
        } else if (isValidSolanaAddress(seed)) {
          // Public key seed
          seedBuffer = new PublicKey(seed).toBuffer();
          seedType = 'Pubkey';
        } else {
          // UTF-8 string seed
          seedBuffer = Buffer.from(seed, 'utf8');
          seedType = 'String';
        }

        return {
          index,
          originalValue: seed,
          type: seedType,
          buffer: seedBuffer,
          length: seedBuffer.length,
        };
      });

      const seedBuffers = processedSeeds.map((s) => s.buffer);
      const [derivedPda, bump] = PublicKey.findProgramAddressSync(
        seedBuffers,
        new PublicKey(programId)
      );

      // Check if account exists on-chain
      const accountInfo = await connection.getAccountInfo(derivedPda);

      return {
        success: true,
        address: derivedPda.toBase58(),
        bump,
        programId: programId,
        seeds: processedSeeds.map((s) => ({
          index: s.index,
          value: s.originalValue,
          type: s.type,
          length: s.length,
        })),
        onChainStatus: {
          exists: accountInfo !== null,
          lamports: accountInfo?.lamports || 0,
          dataSize: accountInfo?.data?.length || 0,
          owner: accountInfo?.owner?.toBase58() || 'No owner',
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to derive PDA address: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 8. Search Accounts by Public Key Field Tool - Find accounts that reference a specific public key
export const searchAccountsByPubkeyTool = createTool({
  id: 'search-accounts-by-pubkey',
  description:
    'Search for accounts that contain a specific public key in any field',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    accountName: z.string().describe('Name of the account structure'),
    targetPubkey: z.string().describe('Public key to search for'),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe('Maximum number of accounts to return (default 20)'),
  }),
  execute: async ({ context }) => {
    const { programId, accountName, targetPubkey, limit = 20 } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    if (!isValidSolanaAddress(targetPubkey)) {
      throw new Error('Invalid target public key format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const program = new anchor.Program(idl as anchor.Idl, { connection });

      // Find account structure in IDL (case-insensitive search)
      const accountStruct = idl.accounts?.find(
        (acc: any) => acc.name.toLowerCase() === accountName.toLowerCase()
      );
      if (!accountStruct) {
        const availableAccounts = (idl.accounts || []).map(
          (acc: any) => acc.name
        );
        throw new Error(
          `Account structure '${accountName}' not found in IDL. Available accounts: ${availableAccounts.join(
            ', '
          )}`
        );
      }

      // Convert account name to camelCase (Anchor convention) - use the actual IDL name
      const camelCaseAccountName =
        accountStruct.name.charAt(0).toLowerCase() +
        accountStruct.name.slice(1);

      // Get all accounts and search for the target pubkey
      const allAccounts = await (program.account as any)[
        camelCaseAccountName
      ].all();

      const matchingAccounts = allAccounts.filter((acc: any) => {
        // Recursively search for the target pubkey in all fields
        const searchInObject = (obj: any): boolean => {
          if (obj === null || obj === undefined) return false;

          // Check if it's a PublicKey object
          if (obj.toBase58 && typeof obj.toBase58 === 'function') {
            return obj.toBase58() === targetPubkey;
          }

          // Check if it's a string that matches the pubkey
          if (typeof obj === 'string' && obj === targetPubkey) {
            return true;
          }

          // If it's an object, search recursively
          if (typeof obj === 'object') {
            return Object.values(obj).some(searchInObject);
          }

          return false;
        };

        return searchInObject(acc.account);
      });

      return {
        accountType: accountName,
        targetPubkey,
        totalMatched: matchingAccounts.length,
        accounts: matchingAccounts.slice(0, limit).map((acc: any) => ({
          address: acc.publicKey.toBase58(),
          data: acc.account,
        })),
        hasMore: matchingAccounts.length > limit,
      };
    } catch (error) {
      throw new Error(
        `Failed to search accounts by pubkey: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 9. List All Instructions Tool
export const listAllInstructionsTool = createTool({
  id: 'list-all-instructions',
  description: 'Get detailed information about all program instructions',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
  }),
  execute: async ({ context }) => {
    const { programId } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const instructions = (idl.instructions || []).map((inst: any) => ({
        name: inst.name,
        description: inst.docs?.join(' ') || 'No description available',
        accounts: (inst.accounts || []).map((acc: any) => ({
          name: acc.name,
          writable: acc.isMut ? 'Yes' : 'No',
          signer: acc.isSigner ? 'Yes' : 'No',
          optional: acc.isOptional ? 'Yes' : 'No',
          description: (acc.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 8)
            .join(' '),
        })),
        args: (inst.args || []).map((arg: any) => ({
          name: arg.name,
          type:
            typeof arg.type === 'string' ? arg.type : JSON.stringify(arg.type),
          description: (arg.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 6)
            .join(' '),
        })),
        counts: {
          accounts: (inst.accounts || []).length,
          args: (inst.args || []).length,
        },
      }));

      return {
        instructionCount: instructions.length,
        instructions,
      };
    } catch (error) {
      throw new Error(
        `Failed to list all instructions: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 10. List All Accounts Tool
export const listAllAccountsTool = createTool({
  id: 'list-all-accounts',
  description: 'Get detailed information about all program account structures',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    includeFields: z
      .boolean()
      .optional()
      .describe('Include field details (default false)'),
  }),
  execute: async ({ context }) => {
    const { programId, includeFields = false } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const accounts = (idl.accounts || []).map((acc: any) => {
        let fields = (acc as any).type?.fields || [];
        if ((!fields || fields.length === 0) && idl.types) {
          const typeDef = findTypeDef(idl, acc.name);
          if (typeDef?.type?.fields) {
            fields = typeDef.type.fields;
          }
        }

        const baseInfo = {
          name: acc.name,
          description:
            (acc as any).docs?.join(' ') || 'No description available',
          discriminator: (acc as any).discriminator || [],
          fieldCount: fields.length,
          size: (acc as any).type?.size || 'Variable',
        } as any;

        if (includeFields) {
          baseInfo.fields = (fields || []).map((field: any) => ({
            name: field.name,
            type:
              typeof field.type === 'string'
                ? field.type
                : JSON.stringify(field.type),
            description: (field.docs?.join(' ') || 'No description')
              .split(' ')
              .slice(0, 6)
              .join(' '),
          }));
        }

        return baseInfo;
      });

      return {
        accountCount: accounts.length,
        accounts,
      };
    } catch (error) {
      throw new Error(
        `Failed to list all accounts: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 11. List All Errors Tool
export const listAllErrorsTool = createTool({
  id: 'list-all-errors',
  description: 'Get detailed information about all program errors',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
  }),
  execute: async ({ context }) => {
    const { programId } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const errors = (idl.errors || []).map((err: any) => ({
        code: err.code,
        name: err.name,
        msg: err.msg || 'No message',
        description: (err as any).docs?.join(' ') || 'No description available',
      }));

      return {
        errorCount: errors.length,
        errors,
      };
    } catch (error) {
      throw new Error(
        `Failed to list all errors: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 12. List All Types Tool
export const listAllTypesTool = createTool({
  id: 'list-all-types',
  description: 'Get detailed information about all program types and structs',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    includeFields: z
      .boolean()
      .optional()
      .describe('Include field details (default false)'),
  }),
  execute: async ({ context }) => {
    const { programId, includeFields = false } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const types = (idl.types || []).map((type: any) => {
        const baseInfo = {
          name: type.name,
          kind: type.type?.kind || 'struct',
          description: type.docs?.join(' ') || 'No description available',
        } as any;

        if (type.type?.kind === 'enum') {
          baseInfo.variantCount = (type.type?.variants || []).length;
          baseInfo.variantNames = (type.type?.variants || []).map(
            (v: any) => v.name
          );

          if (includeFields) {
            baseInfo.variants = (type.type?.variants || []).map((v: any) => ({
              name: v.name,
              fields: v.fields || null,
            }));
          }
        }

        if ((type.type as any)?.kind === 'alias') {
          baseInfo.aliasFor = JSON.stringify((type.type as any)?.alias ?? {});
        }

        if ((type.type as any)?.fields) {
          baseInfo.fieldCount = (type.type as any).fields.length;

          if (includeFields) {
            baseInfo.fields = (type.type as any).fields.map((field: any) => ({
              name: field.name,
              type:
                typeof field.type === 'string'
                  ? field.type
                  : JSON.stringify(field.type),
              description: (field.docs?.join(' ') || 'No description')
                .split(' ')
                .slice(0, 6)
                .join(' '),
            }));
          }
        }

        return baseInfo;
      });

      return {
        typeCount: types.length,
        types,
      };
    } catch (error) {
      throw new Error(
        `Failed to list all types: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 14. Get Error Details Tool - Details of a specific error
export const getErrorDetailsTool = createTool({
  id: 'get-error-details',
  description: 'Get detailed information about a specific program error',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    errorIdentifier: z
      .union([
        z.string().describe('Error name'),
        z.number().describe('Error code'),
      ])
      .describe('Error name or code to look up'),
  }),
  execute: async ({ context }) => {
    const { programId, errorIdentifier } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      // Find error by name or code
      const error = (idl.errors || []).find((err: any) => {
        if (typeof errorIdentifier === 'string') {
          return err.name === errorIdentifier;
        } else {
          return err.code === errorIdentifier;
        }
      });

      if (!error) {
        return {
          found: false,
          message: `Error '${errorIdentifier}' not found in program`,
          availableErrors: (idl.errors || []).map((err: any) => ({
            name: err.name,
            code: err.code,
          })),
        };
      }

      return {
        found: true,
        error: {
          name: error.name,
          code: error.code,
          msg: error.msg || 'No message',
          description:
            (error as any).docs?.join(' ') || 'No description available',
        },
        usage: {
          anchor: `Err(ErrorCode::${error.name})`,
          code: `Error code: ${error.code}`,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to get error details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// 13. Get Program Accounts By Type Tool - List all existing accounts of a specific type
export const getProgramAccountsByTypeTool = createTool({
  id: 'get-program-accounts-by-type',
  description:
    'List all existing accounts of a specific type using Anchor program.account.all() method',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    accountName: z.string().describe('Name of the account type to search for'),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe('Maximum number of accounts to return (default 50)'),
  }),
  execute: async ({ context }) => {
    const { programId, accountName, limit = 50 } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      // Find account structure in IDL (case-insensitive search)
      const accountStruct = idl.accounts?.find(
        (acc: any) => acc.name.toLowerCase() === accountName.toLowerCase()
      );
      if (!accountStruct) {
        const availableAccounts = (idl.accounts || []).map(
          (acc: any) => acc.name
        );
        throw new Error(
          `Account structure '${accountName}' not found in IDL. Available accounts: ${availableAccounts.join(
            ', '
          )}`
        );
      }

      // Get the discriminator for reference (not used in .all() method)
      const discriminator = (accountStruct as any).discriminator || [];

      // Use Anchor's built-in method to get all accounts (simpler and more reliable)
      const program = new anchor.Program(idl as anchor.Idl, { connection });
      const camelCaseAccountName =
        accountStruct.name.charAt(0).toLowerCase() +
        accountStruct.name.slice(1);

      // Fetch all accounts using Anchor's .all() method
      const accounts = await (program.account as any)[camelCaseAccountName].all();

      // Handle case where no accounts exist
      if (!accounts || accounts.length === 0) {
        return {
          accountType: accountStruct.name,
          discriminator: discriminator,
          totalFound: 0,
          accounts: [],
          hasMore: false,
          searchMethod: 'Anchor program.account.all() method',
          message: `No ${accountStruct.name} accounts found for this program.`,
        };
      }

      const decodedAccounts = accounts.slice(0, limit).map((account: any) => ({
        address: account.publicKey.toBase58(),
        data: account.account,
        lamports: 0, // .all() doesn't provide lamports info
        owner: programId,
        executable: false,
        rentEpoch: 0,
      }))

      return {
        accountType: accountStruct.name,
        discriminator: discriminator,
        totalFound: accounts.length,
        accounts: decodedAccounts,
        hasMore: accounts.length > limit,
        searchMethod: 'Anchor program.account.all() method',
      };
    } catch (error) {
      // More detailed error reporting
      if (error instanceof Error) {
        if (error.message.includes('Program account not found')) {
          throw new Error(`Program ${programId} not found on-chain. Check if the program is deployed.`);
        }
        if (error.message.includes('Invalid program id')) {
          throw new Error(`Invalid program ID format: ${programId}`);
        }
        if (error.message.includes('No IDL found')) {
          throw new Error(`No IDL found for program ${programId}. This may not be an Anchor program or IDL is not published.`);
        }
        throw new Error(`Failed to get ${accountName} accounts: ${error.message}`);
      }
      throw new Error(`Failed to get ${accountName} accounts: Unknown error occurred`);
    }
  },
});

// 15. Get Type Details Tool - Details of a specific type/struct
export const getTypeDetailsTool = createTool({
  id: 'get-type-details',
  description:
    'Get detailed information about a specific program type or struct',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    typeName: z.string().describe('Name of the type/struct to analyze'),
  }),
  execute: async ({ context }) => {
    const { programId, typeName } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      // Find type definition
      const typeDef = (idl.types || []).find(
        (type: any) => type.name === typeName
      );

      if (!typeDef) {
        return {
          found: false,
          message: `Type '${typeName}' not found in program`,
          availableTypes: (idl.types || []).map((type: any) => ({
            name: type.name,
            kind: type.type?.kind || 'struct',
          })),
        };
      }

      const result = {
        found: true,
        type: {
          name: typeDef.name,
          kind: typeDef.type?.kind || 'struct',
          description: typeDef.docs?.join(' ') || 'No description available',
        } as any,
      };

      // Handle different type kinds
      if (typeDef.type?.kind === 'struct' || !typeDef.type?.kind) {
        result.type.fields = (typeDef.type?.fields || []).map((field: any) => ({
          name: field.name,
          type:
            typeof field.type === 'string'
              ? field.type
              : JSON.stringify(field.type),
          description: (field.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 8)
            .join(' '),
        }));
        result.type.fieldCount = (typeDef.type?.fields || []).length;
      }

      if (typeDef.type?.kind === 'enum') {
        result.type.variants = (typeDef.type?.variants || []).map(
          (variant: any) => ({
            name: variant.name,
            fields: variant.fields || null,
            description: (variant.docs?.join(' ') || 'No description')
              .split(' ')
              .slice(0, 6)
              .join(' '),
          })
        );
        result.type.variantCount = (typeDef.type?.variants || []).length;
      }

      if ((typeDef.type as any)?.kind === 'alias') {
        result.type.aliasFor = (typeDef.type as any)?.alias;
        result.type.resolvedType = JSON.stringify((typeDef.type as any)?.alias);
      }

      // Size information if available
      if ((typeDef.type as any)?.size) {
        result.type.size = (typeDef.type as any).size;
        result.type.sizeBytes = (typeDef.type as any).size;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to get type details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});
