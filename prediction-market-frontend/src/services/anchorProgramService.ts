import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from '../idl/pumpsly.json';

// Program ID from deployed contract
const PROGRAM_ID = new PublicKey('6rz87uKkR5nnwsBc6cYJ8EreCFSTcekbEMUou4bkkjCH');
const RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet');

/**
 * Anchor Program Service - Real smart contract integration
 * 
 * Provides type-safe access to deployed Pumpsly smart contract
 * Supports:
 * - AMM Pool operations (create, buy, sell, resolve)
 * - Duel operations (initialize, join, start, resolve)
 * - On-chain state queries
 */
class AnchorProgramService {
    private connection: Connection;
    private program: Program<any> | null = null;

    constructor() {
        this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    }

    /**
     * Initialize Anchor program with wallet
     */
    initializeProgram(wallet: AnchorWallet): Program<any> {
        const provider = new AnchorProvider(
            this.connection,
            wallet,
            { commitment: 'confirmed' }
        );

        this.program = new Program(idl as any, provider);
        return this.program;
    }

    /**
     * Get program instance (must call initializeProgram first)
     */
    getProgram(): Program<any> {
        if (!this.program) {
            throw new Error('Program not initialized. Call initializeProgram with wallet first.');
        }
        return this.program;
    }

    /**
     * Get connection instance
     */
    getConnection(): Connection {
        return this.connection;
    }

    /**
     * Get program ID
     */
    getProgramId(): PublicKey {
        return PROGRAM_ID;
    }

    // ============================================================================
    // PDA DERIVATION HELPERS
    // ============================================================================

    /**
     * Derive pool PDA
     */
    getPoolPda(poolId: BN): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('pool'), poolId.toArrayLike(Buffer, 'le', 8)],
            PROGRAM_ID
        );
    }

    /**
     * Derive pool vault PDA
     */
    getPoolVaultPda(poolId: BN, tokenMint: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from('pool_vault'),
                poolId.toArrayLike(Buffer, 'le', 8),
                tokenMint.toBuffer()
            ],
            PROGRAM_ID
        );
    }

    /**
     * Derive user position PDA
     */
    getUserPositionPda(poolId: BN, user: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from('position'),
                poolId.toArrayLike(Buffer, 'le', 8),
                user.toBuffer()
            ],
            PROGRAM_ID
        );
    }

    /**
     * Derive duel PDA
     */
    getDuelPda(duelId: BN): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('duel'), duelId.toArrayLike(Buffer, 'le', 8)],
            PROGRAM_ID
        );
    }

    /**
     * Derive duel vault PDA
     */
    getDuelVaultPda(duelId: BN, tokenMint: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from('duel_vault'),
                duelId.toArrayLike(Buffer, 'le', 8),
                tokenMint.toBuffer()
            ],
            PROGRAM_ID
        );
    }

    // ============================================================================
    // POOL OPERATIONS
    // ============================================================================

    /**
     * Create AMM pool
     */
    async createPool(
        poolId: BN,
        question: string,
        resolutionTime: BN,
        initialLiquidity: BN,
        tokenMint: PublicKey,
        authorityTokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);
        const [poolVaultPda] = this.getPoolVaultPda(poolId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .createPool(poolId, question, resolutionTime, initialLiquidity)
            .accounts({
                pool: poolPda,
                poolVault: poolVaultPda,
                tokenMint,
                authorityTokenAccount,
                authority: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Buy outcome tokens (YES or NO)
     */
    async buyOutcome(
        poolId: BN,
        outcome: { yes: {} } | { no: {} },
        amount: BN,
        minTokensOut: BN,
        tokenMint: PublicKey,
        userTokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);
        const [poolVaultPda] = this.getPoolVaultPda(poolId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const [userPositionPda] = this.getUserPositionPda(poolId, program.provider.publicKey);

        const tx = await (program.methods as any)
            .buyOutcome(outcome, amount, minTokensOut)
            .accounts({
                pool: poolPda,
                poolVault: poolVaultPda,
                userPosition: userPositionPda,
                userTokenAccount,
                user: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Get pool state
     */
    async getPool(poolId: BN): Promise<any> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);
        return await (program.account as any)['pool'].fetch(poolPda);
    }

    /**
     * Get user position
     */
    async getUserPosition(poolId: BN, user: PublicKey): Promise<any> {
        const program = this.getProgram();
        const [userPositionPda] = this.getUserPositionPda(poolId, user);

        try {
            return await (program.account as any)['userPosition'].fetch(userPositionPda);
        } catch (error) {
            // Position doesn't exist yet
            return null;
        }
    }

    // ============================================================================
    // DUEL OPERATIONS
    // ============================================================================

    /**
     * Initialize duel
     */
    async initializeDuel(
        duelId: BN,
        amount: BN,
        predictedOutcome: number,
        tokenMint: PublicKey,
        player1TokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);
        const [duelVaultPda] = this.getDuelVaultPda(duelId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .initializeDuel(duelId, amount, predictedOutcome)
            .accounts({
                duel: duelPda,
                duelVault: duelVaultPda,
                tokenMint,
                player1TokenAccount,
                player1: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Join duel
     */
    async joinDuel(
        duelId: BN,
        predictedOutcome: number,
        tokenMint: PublicKey,
        player2TokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);
        const [duelVaultPda] = this.getDuelVaultPda(duelId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .joinDuel(predictedOutcome)
            .accounts({
                duel: duelPda,
                duelVault: duelVaultPda,
                player2TokenAccount,
                player2: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Start duel (authority only)
     */
    async startDuel(
        duelId: BN,
        entryPrice: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .startDuel(entryPrice)
            .accounts({
                duel: duelPda,
                authority: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Resolve duel (authority only)
     */
    async resolveDuel(
        duelId: BN,
        exitPrice: BN,
        tokenMint: PublicKey,
        player1TokenAccount: PublicKey,
        player2TokenAccount: PublicKey,
        feeCollectorTokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);
        const [duelVaultPda] = this.getDuelVaultPda(duelId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .resolveDuel(exitPrice)
            .accounts({
                duel: duelPda,
                duelVault: duelVaultPda,
                player1TokenAccount,
                player2TokenAccount,
                feeCollector: feeCollectorTokenAccount,
                authority: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    // ============================================================================
    // ADDITIONAL POOL OPERATIONS
    // ============================================================================

    /**
     * Sell outcome tokens back to pool
     */
    async sellOutcome(
        poolId: BN,
        outcome: { yes: {} } | { no: {} },
        tokensAmount: BN,
        minSolOut: BN,
        tokenMint: PublicKey,
        userTokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);
        const [poolVaultPda] = this.getPoolVaultPda(poolId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const [userPositionPda] = this.getUserPositionPda(poolId, program.provider.publicKey);

        const tx = await (program.methods as any)
            .sellOutcome(outcome, tokensAmount, minSolOut)
            .accounts({
                pool: poolPda,
                poolVault: poolVaultPda,
                userPosition: userPositionPda,
                userTokenAccount: userTokenAccount,
                user: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Cancel duel and refund player 1 (after 5 min timeout)
     */
    async cancelDuel(
        duelId: BN,
        tokenMint: PublicKey,
        player1TokenAccount: PublicKey
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);
        const [duelVaultPda] = this.getDuelVaultPda(duelId, tokenMint);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .cancelDuel()
            .accounts({
                duel: duelPda,
                duelVault: duelVaultPda,
                player1TokenAccount: player1TokenAccount,
                player1: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Update pool status (authority only)
     */
    async updatePoolStatus(
        poolId: BN,
        newStatus: { active: {} } | { resolved: {} }
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .updatePoolStatus(newStatus)
            .accounts({
                pool: poolPda,
                authority: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }
}

export default new AnchorProgramService();
