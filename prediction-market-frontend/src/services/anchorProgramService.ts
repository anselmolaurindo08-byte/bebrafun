import { Connection, PublicKey, clusterApiUrl, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from '../idl/pumpsly.json';

// Program ID from deployed contract
const PROGRAM_ID = new PublicKey('BRMPh8spJYvp9VAbYGfvECE2MdsYaEGsL94RYH58aius');
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



    // ============================================================================
    // POOL OPERATIONS
    // ============================================================================

    /**
     * Create AMM pool with SOL
     */
    async createPool(
        poolId: BN,
        question: string,
        resolutionTime: BN,
        initialLiquidity: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .createPool(poolId, question, resolutionTime, initialLiquidity)
            .accounts({
                pool: poolPda,
                authority: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    }

    /**
     * Buy outcome shares with SOL (YES or NO)
     */
    async buyOutcome(
        poolId: BN,
        outcome: { yes: {} } | { no: {} },
        solAmount: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const [userPositionPda] = this.getUserPositionPda(poolId, program.provider.publicKey);

        // min_tokens_out set to 0 for no slippage protection
        const minTokensOut = new BN(0);

        const tx = await (program.methods as any)
            .buyOutcome(outcome, solAmount, minTokensOut)
            .accounts({
                pool: poolPda,
                userPosition: userPositionPda,
                user: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
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

        console.log('[getUserPosition] Fetching position for:', {
            poolId: poolId.toString(),
            user: user.toString(),
            pda: userPositionPda.toString()
        });

        try {
            const position = await (program.account as any)['userPosition'].fetch(userPositionPda);
            console.log('[getUserPosition] Position found:', position);
            return position;
        } catch (error) {
            // Position doesn't exist yet
            console.log('[getUserPosition] Position not found:', error);
            return null;
        }
    }

    /**
     * Get pool state directly from blockchain
     */
    async getPoolState(poolId: BN): Promise<any> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        console.log('[getPoolState] Fetching pool:', {
            poolId: poolId.toString(),
            pda: poolPda.toString()
        });

        try {
            const pool = await (program.account as any)['ammPool'].fetch(poolPda);
            console.log('[getPoolState] Pool found:', pool);
            return pool;
        } catch (error) {
            console.log('[getPoolState] Pool not found:', error);
            return null;
        }
    }

    /**
     * Sell outcome shares for SOL (YES or NO)
     */
    async sellOutcome(
        poolId: BN,
        outcome: { yes: {} } | { no: {} },
        sharesAmount: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const [userPositionPda] = this.getUserPositionPda(poolId, program.provider.publicKey);

        // min_sol_out set to 0 for no slippage protection
        const minSolOut = new BN(0);

        const tx = await (program.methods as any)
            .sellOutcome(outcome, sharesAmount, minSolOut)
            .accounts({
                pool: poolPda,
                userPosition: userPositionPda,
                user: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    }

    /**
     * Resolve pool (admin only)
     */
    async resolvePool(
        poolId: BN,
        outcome: { yes: {} } | { no: {} } | { invalid: {} }
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .resolvePool(outcome)
            .accounts({
                pool: poolPda,
                authority: program.provider.publicKey,
            })
            .rpc();

        return tx;
    }

    /**
     * Claim winnings from resolved pool
     */
    async claimWinnings(
        poolId: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [poolPda] = this.getPoolPda(poolId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const [userPositionPda] = this.getUserPositionPda(poolId, program.provider.publicKey);

        const tx = await (program.methods as any)
            .claimWinnings()
            .accounts({
                pool: poolPda,
                userPosition: userPositionPda,
                user: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    }

    // ============================================================================
    // DUEL OPERATIONS
    // ============================================================================

    /**
     * Initialize duel with SOL
     */
    async initializeDuel(
        duelId: BN,
        amount: BN,
        predictedOutcome: number
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .initializeDuel(duelId, amount, predictedOutcome)
            .accounts({
                duel: duelPda,
                player1: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    }

    /**
     * Join duel with SOL
     */
    async joinDuel(
        duelId: BN,
        predictedOutcome: number
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .joinDuel(predictedOutcome)
            .accounts({
                duel: duelPda,
                player2: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
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
     * Resolve duel (authority only) - pays out SOL to winner
     */
    async resolveDuel(
        duelId: BN,
        exitPrice: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .resolveDuel(exitPrice)
            .accounts({
                duel: duelPda,
                authority: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    }



    /**
     * Cancel duel and refund player 1 (after 5 min timeout) - returns SOL
     */
    async cancelDuel(
        duelId: BN
    ): Promise<string> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);

        if (!program.provider.publicKey) {
            throw new Error('Wallet not connected');
        }

        const tx = await (program.methods as any)
            .cancelDuel()
            .accounts({
                duel: duelPda,
                player1: program.provider.publicKey,
                systemProgram: SystemProgram.programId,
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
