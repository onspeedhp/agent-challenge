import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import { solanaRpcUrl } from '../../../config';
import {
  SolanaAccount,
  SolanaStakeAccount,
  SolanaNftCollection,
} from './types';
import { fetchTokenMetadata, isValidSolanaAddress } from './utils';

export const solanaAccountAnalyzer = createTool({
  id: 'solana-account-analyzer',
  description:
    'Comprehensive Solana account analysis including tokens, NFTs, and staking',
  inputSchema: z.object({
    address: z.string().describe('Solana wallet address to analyze'),
    includeTokens: z
      .boolean()
      .optional()
      .describe('Include SPL token analysis')
      .default(true),
    includeNfts: z
      .boolean()
      .optional()
      .describe('Include NFT collection analysis')
      .default(true),
    includeStaking: z
      .boolean()
      .optional()
      .describe('Include staking analysis')
      .default(true),
  }),
  outputSchema: z.object({
    account: z.object({
      pubkey: z.string(),
      lamports: z.number(),
      solBalance: z.number(),
      owner: z.string(),
      executable: z.boolean(),
      rentEpoch: z.number(),
      tokens: z.array(
        z.object({
          mint: z.string(),
          symbol: z.string(),
          name: z.string(),
          balance: z.number(),
          uiAmount: z.number(),
          decimals: z.number(),
          isNft: z.boolean(),
        })
      ),
    }),
    stakeAccounts: z.array(
      z.object({
        pubkey: z.string(),
        lamports: z.number(),
        stakeAmount: z.number(),
        validator: z.string(),
        delegatedStake: z.number(),
        activationEpoch: z.number(),
        deactivationEpoch: z.number().nullable(),
        status: z.enum(['active', 'inactive', 'activating', 'deactivating']),
        rewards: z.number(),
        apr: z.number(),
      })
    ),
    nftCollection: z.array(
      z.object({
        mint: z.string(),
        name: z.string(),
        symbol: z.string(),
        uri: z.string(),
        collectionKey: z.string(),
        creators: z.array(
          z.object({
            address: z.string(),
            verified: z.boolean(),
            share: z.number(),
          })
        ),
        attributes: z.array(
          z.object({
            trait_type: z.string(),
            value: z.string(),
          })
        ),
        floorPrice: z.number(),
        marketCap: z.number(),
        volume24h: z.number(),
      })
    ),
    portfolioValue: z.object({
      totalValue: z.number(),
      solValue: z.number(),
      tokenValue: z.number(),
      nftValue: z.number(),
      stakingValue: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { address, includeTokens, includeNfts, includeStaking } = context;

    if (!isValidSolanaAddress(address)) {
      throw new Error('Invalid Solana address format');
    }

    try {
      // Create connection to Solana devnet
      const connection = new Connection(solanaRpcUrl, 'confirmed');
      const publicKey = new PublicKey(address);

      // Get account info
      const accountInfo = await connection.getAccountInfo(publicKey);

      if (!accountInfo) {
        throw new Error('Account not found on Solana blockchain');
      }

      // Get SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solBalanceInSol = solBalance / 1e9; // Convert lamports to SOL

      // Get token accounts if requested
      let tokens: any[] = [];
      if (includeTokens) {
        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            publicKey,
            {
              programId: new PublicKey(
                'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
              ),
            }
          );

          // Process tokens with metadata fetching in batches
          const batchSize = 5; // Process 5 tokens at a time to avoid rate limits
          tokens = [];

          for (let i = 0; i < tokenAccounts.value.length; i += batchSize) {
            const batch = tokenAccounts.value.slice(i, i + batchSize);
            const batchPromises = batch.map(async (tokenAccount) => {
              const parsedInfo = tokenAccount.account.data.parsed.info;

              // Fetch real token metadata
              const metadata = await fetchTokenMetadata(
                connection,
                parsedInfo.mint
              );

              return {
                mint: parsedInfo.mint,
                symbol: metadata.symbol,
                name: metadata.name,
                balance: parseInt(parsedInfo.tokenAmount.amount),
                uiAmount: parseFloat(
                  parsedInfo.tokenAmount.uiAmountString || '0'
                ),
                decimals: parsedInfo.tokenAmount.decimals,
                isNft:
                  parsedInfo.tokenAmount.decimals === 0 &&
                  parsedInfo.tokenAmount.uiAmount === 1,
              };
            });

            // Wait for current batch to complete
            const batchResults = await Promise.all(batchPromises);
            tokens.push(...batchResults);
          }
        } catch (error) {
          console.warn('Failed to fetch token accounts:', error);
          tokens = [];
        }
      }

      // Filter out NFTs from regular tokens
      const regularTokens = tokens.filter((token) => !token.isNft);
      const nftTokens = tokens.filter((token) => token.isNft);

      // Get NFT collection info if requested
      let nftCollection: any[] = [];
      if (includeNfts && nftTokens.length > 0) {
        nftCollection = nftTokens.map((nft) => ({
          mint: nft.mint,
          name:
            nft.name !== 'Unknown Token'
              ? nft.name
              : `NFT ${nft.mint.substring(0, 8)}...`,
          symbol: nft.symbol !== 'UNKNOWN' ? nft.symbol : 'NFT',
          uri: (nft as any).image || '',
          collectionKey: '',
          creators: [],
          attributes: [],
          floorPrice: 0, // Would need marketplace data
          marketCap: 0,
          volume24h: 0,
        }));
      }

      // Get stake accounts if requested
      let stakeAccounts: any[] = [];
      if (includeStaking) {
        try {
          const stakeAccountsResponse =
            await connection.getParsedProgramAccounts(
              new PublicKey('Stake11111111111111111111111111111111111111'),
              {
                filters: [
                  {
                    memcmp: {
                      offset: 12, // Stake authority offset
                      bytes: publicKey.toBase58(),
                    },
                  },
                ],
              }
            );

          stakeAccounts = stakeAccountsResponse.map((stakeAccount) => {
            const accountData = stakeAccount.account.data;
            const parsedInfo = (accountData as any).parsed?.info;
            return {
              pubkey: stakeAccount.pubkey.toBase58(),
              lamports: stakeAccount.account.lamports,
              stakeAmount: stakeAccount.account.lamports / 1e9,
              validator: parsedInfo?.stake?.delegation?.voter || '',
              delegatedStake: parsedInfo?.stake?.delegation?.stake
                ? parseInt(parsedInfo.stake.delegation.stake) / 1e9
                : 0,
              activationEpoch:
                parsedInfo?.stake?.delegation?.activationEpoch || 0,
              deactivationEpoch:
                parsedInfo?.stake?.delegation?.deactivationEpoch || null,
              status: parsedInfo?.stake?.delegation?.deactivationEpoch
                ? 'deactivating'
                : 'active',
              rewards: 0, // Would need historical data
              apr: 7.5, // Estimated APR
            };
          });
        } catch (error) {
          console.warn('Failed to fetch stake accounts:', error);
          stakeAccounts = [];
        }
      }

      // Calculate portfolio value (mock SOL price for calculation)
      const mockSolPrice = 100; // $100 USD per SOL
      const solValue = solBalanceInSol * mockSolPrice;
      const tokenValue = regularTokens.reduce(
        (sum, token) => sum + token.uiAmount,
        0
      );
      const nftValue = nftCollection.length * 50; // Mock NFT value
      const stakingValue = stakeAccounts.reduce(
        (sum, stake) => sum + stake.stakeAmount * mockSolPrice,
        0
      );

      return {
        account: {
          pubkey: address,
          lamports: solBalance,
          solBalance: solBalanceInSol,
          owner: accountInfo.owner.toBase58(),
          executable: accountInfo.executable,
          rentEpoch: accountInfo.rentEpoch || 0,
          tokens: regularTokens,
        },
        stakeAccounts,
        nftCollection,
        portfolioValue: {
          totalValue: solValue + tokenValue + nftValue + stakingValue,
          solValue,
          tokenValue,
          nftValue,
          stakingValue,
        },
      };
    } catch (error) {
      console.error('Error fetching Solana account data:', error);
      throw new Error(
        `Failed to fetch Solana account data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
});
