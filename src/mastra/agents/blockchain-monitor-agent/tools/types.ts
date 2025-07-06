import { Connection, PublicKey } from '@solana/web3.js';

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
