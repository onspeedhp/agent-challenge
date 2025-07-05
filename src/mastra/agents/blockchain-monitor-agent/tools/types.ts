import { Connection, PublicKey } from '@solana/web3.js';

// ===== SHARED SOLANA INTERFACES =====

export interface SolanaTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  fee: number;
  status: 'confirmed' | 'finalized' | 'processed';
  programInstructions: Array<{
    programId: string;
    programName: string;
    instruction: string;
  }>;
  balanceChanges: Array<{
    account: string;
    before: number;
    after: number;
    change: number;
  }>;
  tokenTransfers: Array<{
    mint: string;
    from: string;
    to: string;
    amount: number;
    decimals: number;
  }>;
}

export interface SolanaAccount {
  pubkey: string;
  lamports: number;
  solBalance: number;
  owner: string;
  executable: boolean;
  rentEpoch: number;
  tokens: Array<{
    mint: string;
    symbol: string;
    name: string;
    balance: number;
    uiAmount: number;
    decimals: number;
    isNft: boolean;
  }>;
}

export interface SolanaStakeAccount {
  pubkey: string;
  lamports: number;
  stakeAmount: number;
  validator: string;
  delegatedStake: number;
  activationEpoch: number;
  deactivationEpoch: number | null;
  status: 'active' | 'inactive' | 'activating' | 'deactivating';
  rewards: number;
  apr: number;
}

export interface SolanaNftCollection {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  collectionKey: string;
  creators: Array<{
    address: string;
    verified: boolean;
    share: number;
  }>;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  floorPrice: number;
  marketCap: number;
  volume24h: number;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  image: string | null;
}

// Anchor Program Monitor Types
export interface ProgramInfo {
  address: string;
  name: string;
  version: string;
  spec: string;
  description: string;
}

export interface InstructionInfo {
  name: string;
  discriminator: number[];
  docs?: string[];
  accounts: Array<{
    name: string;
    writable?: boolean;
    signer?: boolean;
    pda?: {
      seeds: any[];
    };
  }>;
  args: Array<{
    name: string;
    type: any;
  }>;
}

export interface AccountInfo {
  name: string;
  discriminator: number[];
  type: {
    kind: string;
    fields: Array<{
      name: string;
      type: any;
    }>;
  };
}

export interface PDAAccountData {
  address: string;
  accountType: string;
  data?: any;
  exists: boolean;
}

export interface ErrorInfo {
  code: number;
  name: string;
  msg: string;
}

export interface TypeInfo {
  name: string;
  type: any;
}

// Enhanced Anchor Program Monitor Result Types
export interface AnalysisResult {
  type: 'analysis';
  instructions: InstructionInfo[];
  accounts: AccountInfo[];
  errors: ErrorInfo[];
  types: TypeInfo[];
}

export interface InstructionListResult {
  type: 'instruction-list';
  instructions: Array<{
    name: string;
    description: string;
    requiredAccounts: string[];
    requiredArgs: string[];
  }>;
  defaultInstruction?: {
    name: string;
    accounts: Array<{
      name: string;
      required: boolean;
      type: string;
      description?: string;
    }>;
    args: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  };
}

export interface InstructionDetailsResult {
  type: 'instruction-details';
  instruction: {
    name: string;
    description: string;
    accounts: Array<{
      name: string;
      writable?: boolean;
      signer?: boolean;
      description?: string;
    }>;
    args: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
    discriminator: number[];
  };
}

export interface PDAListResult {
  type: 'pda-list';
  pdaStructs: Array<{
    name: string;
    description: string;
    fields: Array<{
      name: string;
      type: string;
    }>;
  }>;
}

export interface PDADataResult {
  type: 'pda-data';
  accountData: {
    address: string;
    struct: string;
    exists: boolean;
    data?: {
      raw?: string;
      lamports?: number;
      owner?: string;
      parsed?: any;
      count?: number;
      accounts?: Array<{
        address: string;
        lamports: number;
        data: string;
      }>;
      note?: string;
    };
  };
}

export type AnchorProgramResult =
  | AnalysisResult
  | InstructionListResult
  | InstructionDetailsResult
  | PDAListResult
  | PDADataResult;
