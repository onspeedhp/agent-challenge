import { Connection, PublicKey } from '@solana/web3.js';

// Well-known program names for better identification
export const getProgramName = (programId: string): string => {
  const programNames: Record<string, string> = {
    '11111111111111111111111111111111': 'System Program',
    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Serum DEX',
    srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX: 'Serum',
    SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8: 'Swap Program',
    ComputeBudget111111111111111111111111111111: 'Compute Budget',
    Vote111111111111111111111111111111111111111: 'Vote Program',
    Stake11111111111111111111111111111111111111: 'Stake Program',
  };

  return programNames[programId] || 'Unknown Program';
};

// Helper function to parse PDA seeds from IDL
export const parsePdaSeeds = (seeds: any[], programId: string) => {
  return seeds.map((seed: any) => {
    if (seed.kind === 'const') {
      return Buffer.from(seed.value);
    } else if (seed.kind === 'account') {
      // This would need the actual account data to resolve
      return seed.path;
    } else if (seed.kind === 'arg') {
      // This would need the instruction arguments to resolve
      return seed.path;
    }
    return seed;
  });
};

// Helper function to derive PDA addresses
export const derivePdaAddress = async (
  connection: Connection,
  programId: string,
  seeds: Buffer[]
): Promise<string | null> => {
  try {
    const [pda] = PublicKey.findProgramAddressSync(
      seeds,
      new PublicKey(programId)
    );
    return pda.toBase58();
  } catch (error) {
    console.warn('Failed to derive PDA:', error);
    return null;
  }
};

// Validate Solana address format
export const isValidSolanaAddress = (address: string): boolean => {
  if (!address || address.length < 32 || address.length > 44) {
    return false;
  }

  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Validate and parse IDL
export const validateAndParseIdl = (idlJson: string) => {
  try {
    const idl = JSON.parse(idlJson);

    // Validate basic IDL structure
    if (!idl.address) {
      throw new Error('IDL missing program address');
    }

    if (!idl.metadata) {
      throw new Error('IDL missing metadata');
    }

    return idl;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Invalid JSON format in IDL. Please provide a valid Anchor IDL JSON.'
      );
    }
    throw error;
  }
};

// Format type information for display
export const formatType = (type: any): string => {
  if (typeof type === 'string') {
    return type;
  }

  if (typeof type === 'object' && type !== null) {
    if (type.option) {
      return `Option<${formatType(type.option)}>`;
    }
    if (type.vec) {
      return `Vec<${formatType(type.vec)}>`;
    }
    if (type.array) {
      return `[${formatType(type.array[0])}; ${type.array[1]}]`;
    }
    if (type.defined) {
      return type.defined;
    }
  }

  return JSON.stringify(type);
};
