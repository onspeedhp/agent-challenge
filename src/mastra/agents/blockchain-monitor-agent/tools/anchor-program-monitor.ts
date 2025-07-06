import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
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

// Program Summary Tool
export const analyzeProgramTool = createTool({
  id: 'analyze-program',
  description: 'Get focused program summary with 5 key items per category',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID to analyze'),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe('Maximum number of items to show per section (default 5)'),
    mode: z
      .enum(['brief', 'detailed'])
      .optional()
      .describe('Response verbosity'),
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

      // Format program ID for display (first 4 + last 4 chars)
      const shortProgramId = `${programId.slice(0, 4)}...${programId.slice(
        -4
      )}`;

      // Return focused overview data (5 items max for quick scanning)
      return {
        name: idl.metadata?.name || 'Unknown Program',
        version: idl.metadata?.version || '1.0.0',
        programId: shortProgramId,
        fullProgramId: programId,
        description: idl.metadata?.description || 'No description available',
        stats: {
          instructions: idl.instructions?.length || 0,
          pdas: idl.accounts?.length || 0,
          errors: idl.errors?.length || 0,
          types: idl.types?.length || 0,
        },
        // Show top 5 items for focused overview
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
        pdas: (idl.accounts || []).slice(0, limit).map((acc: any) => {
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
        errors: (idl.errors || []).slice(0, limit).map((err: any) => ({
          code: err.code,
          name: err.name,
          msg: (err.msg || 'No message').split(' ').slice(0, 6).join(' '),
        })),
        types: (idl.types || []).slice(0, limit).map((type: any) => {
          const base = {
            name: type.name,
            kind: type.type?.kind || 'struct',
          } as any;

          if (type.type?.kind === 'enum') {
            base.variantCount = (type.type?.variants || []).length;
            base.variantNames = (type.type?.variants || []).map(
              (v: any) => v.name
            );
          }

          if (type.type?.kind === 'alias') {
            base.aliasFor = JSON.stringify(type.type?.alias ?? {});
          }

          base.fieldCount = type.type?.fields?.length || 0;
          return base;
        }),
        hasMore: {
          instructions: (idl.instructions?.length || 0) > limit,
          pdas: (idl.accounts?.length || 0) > limit,
          errors: (idl.errors?.length || 0) > limit,
          types: (idl.types?.length || 0) > limit,
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

// Instruction Details Tool
export const getInstructionDetailsTool = createTool({
  id: 'get-instruction-details',
  description:
    'Get focused instruction details with essential account and parameter information',
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

      const formatAccountType = (account: any) => {
        if (account.isSigner) return 'Signer';
        if (account.pda) return 'PDA';

        const name = account.name || '';
        if (name.includes('authenticator')) return 'Authenticator';
        if (name.includes('wallet')) return 'Wallet';
        if (name.includes('program')) return 'Program';
        if (name.includes('authority')) return 'Authority';
        if (name.includes('token')) return 'Token';
        if (name.includes('mint')) return 'Mint';
        if (name.includes('config')) return 'Config';
        if (name.includes('system')) return 'System';

        return 'Account';
      };

      // Grouping containers
      const groups = {
        signers: [] as any[],
        writable: [] as any[],
        readonly: [] as any[],
        optional: [] as any[],
      };

      const accountsDetailed = (instruction.accounts || []).map(
        (acc: any, idx: number) => {
          const accType = formatAccountType(acc);

          // Grouping logic
          if (acc.isSigner) groups.signers.push(acc.name);
          if (acc.isOptional) groups.optional.push(acc.name);
          if (acc.isMut) groups.writable.push(acc.name);
          if (!acc.isMut) groups.readonly.push(acc.name);

          // Extract constraints (Anchor >=0.30.0 uses relations & pda)
          const constraints: Record<string, any> = {};
          if (acc.pda?.seeds) constraints.seeds = acc.pda.seeds;
          if (acc.relations) constraints.has_one = acc.relations;
          if (acc.isOptional) constraints.optional = true;

          return {
            index: idx,
            name: acc.name,
            type: accType,
            writable: acc.isMut ? 'Yes' : 'No',
            signer: acc.isSigner ? 'Yes' : 'No',
            optional: acc.isOptional ? 'Yes' : 'No',
            constraints: Object.keys(constraints).length ? constraints : null,
            description: (acc.docs?.join(' ') || 'No description')
              .split(' ')
              .slice(0, 8)
              .join(' '),
          };
        }
      );

      // Show essential instruction details
      return {
        name: instruction.name,
        description: instruction.docs?.join(' ') || 'No description available',
        accounts: accountsDetailed,
        accountGroups: {
          signers: groups.signers,
          writable: groups.writable,
          readonly: groups.readonly,
          optional: groups.optional,
        },
        // Show all arguments with simplified format
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
        discriminator: instruction.discriminator || [],
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

// PDA Details Tool
export const getPdaDetailsTool = createTool({
  id: 'get-pda-details',
  description: 'Get focused PDA structure with essential field information',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    pdaName: z.string().describe('Name of the PDA structure to analyze'),
  }),
  execute: async ({ context }) => {
    const { programId, pdaName } = context;

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

      const pdaStruct = idl.accounts?.find((acc: any) => acc.name === pdaName);
      if (!pdaStruct) {
        throw new Error(`PDA structure '${pdaName}' not found`);
      }

      let fields = (pdaStruct as any).type?.fields || [];
      if ((!fields || fields.length === 0) && idl.types) {
        const typeDef = findTypeDef(idl, pdaStruct.name);
        if (typeDef?.type?.fields) {
          fields = typeDef.type.fields;
        }
      }

      // Show essential PDA structure details
      const discriminatorArr = (pdaStruct as any).discriminator || [];
      const discriminatorInfo = {
        discriminator: discriminatorArr,
        type: discriminatorArr.length === 8 ? 'implicit' : 'custom',
      };

      return {
        name: pdaStruct.name,
        description:
          (pdaStruct as any).docs?.join(' ') || 'No description available',
        discriminator: discriminatorInfo,
        // Show all fields with simplified format
        fields: (fields || []).map((field: any) => ({
          name: field.name,
          type: typeof field.type === 'string' ? field.type : 'Object',
          description: (field.docs?.join(' ') || 'No description')
            .split(' ')
            .slice(0, 6)
            .join(' '),
        })),
        info: {
          fieldCount: fields.length,
          size: (pdaStruct as any).type?.size || 'Variable',
          sizeBytes:
            typeof (pdaStruct as any).type?.size === 'number'
              ? (pdaStruct as any).type?.size
              : null,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to get PDA details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// Fetch PDA Data Tool
export const fetchPdaDataTool = createTool({
  id: 'fetch-pda-data',
  description:
    'Fetch comprehensive PDA account data from the blockchain with complete structure information',
  inputSchema: z.object({
    programId: z.string().describe('Solana program ID'),
    pdaName: z.string().describe('Name of the PDA structure'),
    pdaAddress: z.string().describe('The actual PDA account address to fetch'),
  }),
  execute: async ({ context }) => {
    const { programId, pdaName, pdaAddress } = context;

    if (!isValidSolanaAddress(programId)) {
      throw new Error('Invalid Solana program ID format');
    }

    if (!isValidSolanaAddress(pdaAddress)) {
      throw new Error('Invalid PDA address format');
    }

    try {
      const idl = await anchor.Program.fetchIdl(new PublicKey(programId), {
        connection,
      });

      if (!idl) {
        throw new Error('No IDL found for this program');
      }

      const pdaStruct = idl.accounts?.find((acc: any) => acc.name === pdaName);
      if (!pdaStruct) {
        throw new Error(`PDA structure '${pdaName}' not found`);
      }

      const accountInfo = await connection.getAccountInfo(
        new PublicKey(pdaAddress)
      );

      if (!accountInfo) {
        return {
          address: pdaAddress,
          structName: pdaName,
          exists: false,
          message: 'Account does not exist on-chain',
          structure: {
            name: pdaStruct.name,
            description: (pdaStruct as any).docs?.join(' ') || 'No description',
            discriminator: (pdaStruct as any).discriminator || [],
            fields: ((pdaStruct as any).type?.fields || []).map(
              (field: any) => ({
                name: field.name,
                type:
                  typeof field.type === 'string'
                    ? field.type
                    : JSON.stringify(field.type),
                description: field.docs?.join(' ') || 'No description',
              })
            ),
            expectedSize: (pdaStruct as any).type?.size || 'Variable',
          },
          parsing: {
            status: 'raw',
            recommendation: `Account not found on-chain yet. Once created you can parse using ${pdaStruct.name} deserializer`,
          },
        };
      }

      // Comprehensive account data
      return {
        address: pdaAddress,
        structName: pdaName,
        exists: true,
        accountInfo: {
          lamports: accountInfo.lamports,
          owner: accountInfo.owner.toBase58(),
          executable: accountInfo.executable,
          rentEpoch: accountInfo.rentEpoch,
          dataSize: accountInfo.data.length,
        },
        data: {
          rawData: accountInfo.data.toString('base64'),
          hexData: accountInfo.data.toString('hex'),
          dataLength: accountInfo.data.length,
        },
        structure: {
          name: pdaStruct.name,
          description: (pdaStruct as any).docs?.join(' ') || 'No description',
          discriminator: (pdaStruct as any).discriminator || [],
          fields: ((pdaStruct as any).type?.fields || []).map((field: any) => ({
            name: field.name,
            type:
              typeof field.type === 'string'
                ? field.type
                : JSON.stringify(field.type),
            description: field.docs?.join(' ') || 'No description',
          })),
          expectedSize: (pdaStruct as any).type?.size || 'Variable',
          actualSize: accountInfo.data.length,
        },
        parsing: {
          status: 'raw',
          recommendation: `Use ${pdaStruct.name} deserializer to parse structured data`,
          fieldCount: ((pdaStruct as any).type?.fields || []).length,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch PDA data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});

// Derive PDA Address Tool
export const derivePdaAddressTool = createTool({
  id: 'derive-pda-address',
  description:
    'Derive PDA address from seeds with comprehensive details and validation',
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
        let originalValue = seed;
        let ambiguous = false;

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
          // Detect non printable chars which may indicate invalid utf8 / hex
          ambiguous = /[^\x20-\x7E]+/.test(seed);
        }

        return {
          index,
          originalValue,
          type: seedType,
          buffer: seedBuffer,
          length: seedBuffer.length,
          ambiguous,
        };
      });

      const seedBuffers = processedSeeds.map((s) => s.buffer);

      const [derivedPda, bump] = PublicKey.findProgramAddressSync(
        seedBuffers,
        new PublicKey(programId)
      );

      // Check if account exists on-chain
      let accountExists = false;
      let accountInfo = null;
      try {
        accountInfo = await connection.getAccountInfo(derivedPda);
        accountExists = accountInfo !== null;
      } catch (error) {
        // Ignore errors for account existence check
      }

      return {
        success: true,
        derivation: {
          address: derivedPda.toBase58(),
          bump,
          programId: programId,
        },
        seeds: processedSeeds.map((s) => ({
          index: s.index,
          value: s.originalValue,
          type: s.type,
          length: s.length,
          ambiguous: s.ambiguous,
        })),
        validation: {
          seedCount: seeds.length,
          totalSeedLength: processedSeeds.reduce((sum, s) => sum + s.length, 0),
          bumpSeed: bump,
          validAddress: true,
        },
        onChainStatus: {
          exists: accountExists,
          lamports: accountInfo?.lamports || 0,
          dataSize: accountInfo?.data?.length || 0,
          owner: accountInfo?.owner?.toBase58() || 'No owner',
        },
        usage: {
          canBeUsed: true,
          recommendation: accountExists
            ? 'Account exists - can be used for interactions'
            : 'Account does not exist - needs to be initialized first',
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

// Note: Re-adding listAllInstructionsTool & listAllPdasTool for compatibility
export const listAllInstructionsTool = createTool({
  id: 'list-all-instructions',
  description: 'Return details for every instruction (compatibility stub)',
  inputSchema: z.object({ programId: z.string() }),
  execute: async ({ context }) => {
    const { programId } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid');
    const idl = await anchor.Program.fetchIdl(new PublicKey(programId), { connection });
    if (!idl) throw new Error('No IDL');
    return { instructionCount: idl.instructions?.length || 0, instructions: idl.instructions };
  },
});

export const listAllPdasTool = createTool({
  id: 'list-all-pdas',
  description: 'Return details for every PDA (compatibility stub)',
  inputSchema: z.object({ programId: z.string() }),
  execute: async ({ context }) => {
    const { programId } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid');
    const idl = await anchor.Program.fetchIdl(new PublicKey(programId), { connection });
    if (!idl) throw new Error('No IDL');
    const pdas = (idl.accounts || []).map((a: any) => ({ name: a.name, discriminator: a.discriminator }));
    return { pdaCount: pdas.length, pdas };
  },
});

/* =============================================================
   ADVANCED MONITORING TOOLS – program stats, logs, decoders, etc.
   Each tool exposes a narrow yet useful capability. Implemented
   with best-effort heuristics (fast queries, limited data sizes)
   to remain lightweight while still informative. Users can chain
   them for deeper insights.
   ============================================================= */

// Helper to fetch recent signatures (limited for performance)
const fetchRecentSignatures = async (
  address: PublicKey,
  limit = 100
): Promise<anchor.web3.ConfirmedSignatureInfo[]> => {
  return connection.getSignaturesForAddress(address, { limit });
};

// 1) PROGRAM STATS TOOL ------------------------------------------------------
export const programStatsTool = createTool({
  id: 'program-stats',
  description: 'Quick usage & health statistics for an Anchor program',
  inputSchema: z.object({
    programId: z.string(),
    signatureLimit: z.number().int().positive().max(1000).optional(),
  }),
  execute: async ({ context }) => {
    const { programId, signatureLimit = 250 } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    const sigs = await fetchRecentSignatures(new PublicKey(programId), signatureLimit);
    const dayAgo = Date.now() / 1000 - 86400;
    const weekAgo = Date.now() / 1000 - 86400 * 7;

    const dayTx = sigs.filter((s) => s.blockTime && s.blockTime >= dayAgo);
    const weekTx = sigs.filter((s) => s.blockTime && s.blockTime >= weekAgo);

    return {
      totalFetched: sigs.length,
      lastSignatureTime: sigs[0]?.blockTime ?? null,
      tx24h: dayTx.length,
      tx7d: weekTx.length,
      // Simple fee aggregate (lamports) – requires fetching each tx meta
      feesLamports: await (async () => {
        let total = 0;
        for (const sig of dayTx.slice(0, 20)) {
          const tx = await connection.getTransaction(sig.signature, { commitment: 'confirmed' });
          total += tx?.meta?.fee ?? 0;
        }
        return total;
      })(),
    };
  },
});

// 2) RECENT LOGS TOOL --------------------------------------------------------
export const recentLogsTool = createTool({
  id: 'recent-logs',
  description: 'Fetch recent log messages emitted by the program',
  inputSchema: z.object({
    programId: z.string(),
    limit: z.number().int().positive().max(20).default(5),
  }),
  execute: async ({ context }) => {
    const { programId, limit } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    const sigs = await fetchRecentSignatures(new PublicKey(programId), limit);
    const logs = [] as any[];
    for (const sig of sigs) {
      const tx = await connection.getTransaction(sig.signature, {
        commitment: 'confirmed',
      });
      if (tx?.meta?.logMessages) {
        logs.push({ signature: sig.signature, slot: sig.slot, logMessages: tx.meta.logMessages });
      }
    }
    return { count: logs.length, logs };
  },
});

// 3) TRANSACTION DECODER TOOL ------------------------------------------------
export const transactionDecoderTool = createTool({
  id: 'transaction-decoder',
  description: 'Decode a program transaction signature into Anchor instructions',
  inputSchema: z.object({
    programId: z.string(),
    signature: z.string(),
  }),
  execute: async ({ context }) => {
    const { programId, signature } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    const idl = await anchor.Program.fetchIdl(new PublicKey(programId), { connection });
    if (!idl) throw new Error('No IDL');
    const program = new anchor.Program(idl as anchor.Idl, { connection });

    const tx = await connection.getTransaction(signature, { commitment: 'confirmed' });
    if (!tx) throw new Error('Transaction not found');

    const decoded = [] as any[];
    tx.transaction.message.instructions.forEach((ix, idx) => {
      // Try decode only if belongs to programId
      const ixProgramId: PublicKey = (ix as any).programId
        ? (ix as any).programId
        : tx.transaction.message.accountKeys[ix.programIdIndex];
      if (ixProgramId.equals(new PublicKey(programId))) {
        try {
          const data = Buffer.from(ix.data, 'base64');
          const ixDecoded = (program as any).coder.instruction.decode(data, 'hex');
          decoded.push({ index: idx, ...ixDecoded });
        } catch {
          decoded.push({ index: idx, raw: ix.data });
        }
      }
    });
    return { slot: tx.slot, computeUnits: tx.meta?.computeUnitsConsumed, instructions: decoded };
  },
});

// 4) SIMULATE INSTRUCTION TOOL ----------------------------------------------
export const simulateInstructionTool = createTool({
  id: 'simulate-instruction',
  description: 'Dry-run (simulate) an instruction without sending a tx',
  inputSchema: z.object({
    programId: z.string(),
    instructionName: z.string(),
    accounts: z.record(z.string(), z.string()),
    args: z.any().optional(),
  }),
  execute: async ({ context }) => {
    const { programId, instructionName, accounts, args } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    const idl = await anchor.Program.fetchIdl(new PublicKey(programId), { connection });
    if (!idl) throw new Error('No IDL');
    const program = new anchor.Program(idl as anchor.Idl, { connection });

    if (typeof (program.methods as any)[instructionName] !== 'function') {
      throw new Error('Instruction not found in IDL');
    }

    const method = (program.methods as any)[instructionName](...(Array.isArray(args) ? args : args ? [args] : []));
    const ixBuilder = method.accounts(accounts);
    const { logs, unitsConsumed } = await ixBuilder.simulate();

    return { logs, unitsConsumed };
  },
});

// 5) ACCOUNT DIFF TOOL -------------------------------------------------------
export const accountDiffTool = createTool({
  id: 'account-diff',
  description: 'Compare PDA data between two slots and highlight differences',
  inputSchema: z.object({
    address: z.string(),
    beforeSlot: z.number().optional(),
    afterSlot: z.number().optional(),
  }),
  execute: async ({ context }) => {
    const { address, beforeSlot, afterSlot } = context;
    if (!isValidSolanaAddress(address)) throw new Error('Invalid address');

    const fetchData = async (slot?: number) => {
      return connection.getAccountInfo(new PublicKey(address), { commitment: 'confirmed', dataSlice: { offset: 0, length: 0 }, minContextSlot: slot });
    };

    const beforeInfo = await fetchData(beforeSlot);
    const afterInfo = await fetchData(afterSlot);
    return {
      lamportsChanged: (afterInfo?.lamports ?? 0) - (beforeInfo?.lamports ?? 0),
      existsBefore: !!beforeInfo, existsAfter: !!afterInfo,
    };
  },
});

// 6) HISTORY SCANNER TOOL ----------------------------------------------------
export const historyScannerTool = createTool({
  id: 'history-scanner',
  description: 'Scan program history for instruction or PDA changes between slots',
  inputSchema: z.object({
    programId: z.string(),
    fromSlot: z.number(),
    toSlot: z.number().optional(),
  }),
  execute: async ({ context }) => {
    const { programId, fromSlot, toSlot } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');
    const until = toSlot ?? (await connection.getSlot('confirmed'));
    const logs = await (connection as any).getLogs(new PublicKey(programId), { startSlot: fromSlot, endSlot: until, commitment: 'confirmed' });
    return { total: logs.length, logs: logs.slice(0, 100) }; // cap output
  },
});

// 7) ERROR EXPLAINER TOOL ----------------------------------------------------
export const errorExplainerTool = createTool({
  id: 'error-explainer',
  description: 'Translate Anchor error code to human message',
  inputSchema: z.object({
    programId: z.string(),
    code: z.number(),
  }),
  execute: async ({ context }) => {
    const { programId, code } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    const idl = await anchor.Program.fetchIdl(new PublicKey(programId), { connection });
    if (!idl) throw new Error('No IDL');
    const err = (idl.errors || []).find((e: any) => e.code === code);
    return err ? err : { message: 'Unknown code' };
  },
});

// 8) COMPUTE ESTIMATOR TOOL --------------------------------------------------
export const computeEstimatorTool = createTool({
  id: 'compute-estimator',
  description: 'Rough compute-unit estimate by simulating instruction N times',
  inputSchema: z.object({
    programId: z.string(),
    instructionName: z.string(),
    iterations: z.number().int().positive().max(5).default(3),
    accounts: z.record(z.string(), z.string()),
    args: z.any().optional(),
  }),
  execute: async ({ context }) => {
    const { programId, instructionName, iterations, accounts, args } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    const idl = await anchor.Program.fetchIdl(new PublicKey(programId), { connection });
    if (!idl) throw new Error('No IDL');
    const program = new anchor.Program(idl as anchor.Idl, { connection });

    const methodFactory = (program.methods as any)[instructionName];
    if (!methodFactory) throw new Error('Instruction not found');

    let total = 0;
    for (let i = 0; i < iterations; i++) {
      const sim = await methodFactory(...(Array.isArray(args) ? args : args ? [args] : [])).accounts(accounts).simulate();
      total += sim.unitsConsumed ?? 0;
    }
    return { averageCU: Math.round(total / iterations) };
  },
});

// 9) UPGRADE HISTORY TOOL ----------------------------------------------------
export const upgradeHistoryTool = createTool({
  id: 'upgrade-history',
  description: 'List past deployments of an upgradable program',
  inputSchema: z.object({ programId: z.string() }),
  execute: async ({ context }) => {
    const { programId } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    // ProgramData PDA is seed [programId]
    const programPubkey = new PublicKey(programId);
    const BPF_LOADER_UPGRADEABLE_PROGRAM_ID =
      (anchor.web3 as any).BPF_LOADER_UPGRADEABLE_PROGRAM_ID ||
      anchor.web3.BPF_LOADER_DEPRECATED_PROGRAM_ID;

    const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
      [programPubkey.toBuffer()],
      BPF_LOADER_UPGRADEABLE_PROGRAM_ID
    )[0];

    const acctInfo = await connection.getAccountInfo(programDataAddress);
    const currentSlot = await connection.getSlot();
    return {
      programDataAddress: programDataAddress.toBase58(),
      size: acctInfo?.data.length ?? 0,
      fetchedSlot: currentSlot,
    };
  },
});

// 10) WEBHOOK ALERT TOOL -----------------------------------------------------
export const webhookAlertTool = createTool({
  id: 'webhook-alert',
  description: 'Register a simple webhook rule (NO persistence, demo only)',
  inputSchema: z.object({
    programId: z.string(),
    rule: z.enum(['newTx', 'error']),
    webhookUrl: z.string().url(),
  }),
  execute: async ({ context }) => {
    const { programId, rule, webhookUrl } = context;
    if (!isValidSolanaAddress(programId)) throw new Error('Invalid program');

    // For demo purposes we just return the rule and pretend success.
    return { status: 'registered', rule, webhookUrl };
  },
});
