import { Connection, PublicKey } from '@solana/web3.js';
import { TokenMetadata } from './types';

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

// Well-known token metadata cache for better performance
const WELL_KNOWN_TOKENS: Record<string, TokenMetadata> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    name: 'USD Coin',
    symbol: 'USDC',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    name: 'Tether USD',
    symbol: 'USDT',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
  So11111111111111111111111111111111111111112: {
    name: 'Wrapped SOL',
    symbol: 'SOL',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    name: 'Raydium',
    symbol: 'RAY',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': {
    name: 'Marinade staked SOL',
    symbol: 'mSOL',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png',
  },
  SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt: {
    name: 'Serum',
    symbol: 'SRM',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png',
  },
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: {
    name: 'Orca',
    symbol: 'ORCA',
    image:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  },
};

// Helper function to fetch token metadata with fallback to known tokens
export const fetchTokenMetadata = async (
  connection: Connection,
  mintAddress: string
): Promise<TokenMetadata> => {
  // Check if it's a well-known token first for better performance
  if (WELL_KNOWN_TOKENS[mintAddress]) {
    return WELL_KNOWN_TOKENS[mintAddress];
  }

  // For unknown tokens, try to get basic info from the mint account
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);

    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      // Generate a basic token name based on mint address
      const shortMint = mintAddress.substring(0, 8);

      return {
        name: `Token ${shortMint}`,
        symbol: shortMint.toUpperCase(),
        image: null,
      };
    }
  } catch (error) {
    console.warn(`Failed to fetch mint info for ${mintAddress}:`, error);
  }

  // Fallback to defaults
  return {
    name: 'Unknown Token',
    symbol: 'UNKNOWN',
    image: null,
  };
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

    // Validate Anchor version
    const spec = idl.metadata.spec;
    if (spec) {
      const [major, minor] = spec.split('.').map(Number);
      if (major === 0 && minor < 30) {
        throw new Error(
          `Anchor version ${spec} not supported. This tool requires Anchor >= 0.30.0`
        );
      }
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
