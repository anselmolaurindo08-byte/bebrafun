import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from '../idl/pumpsly.json';

// Program ID from deployed contract
const PROGRAM_ID = new PublicKey('46XLMDdrHBaV1YeX1nuUwtRM1KNMF1XKEp5DBVSrHcbY');
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
    private program: Program | null = null;

    constructor() {
        this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    }

    /**
     * Initialize Anchor program with wallet
     */
    initializeProgram(wallet: AnchorWallet): Program {
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
    getProgram(): Program {
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

        const tx = await program.methods
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
        const [userPositionPda] = this.getUserPositionPda(poolId, program.provider.publicKey!);

        const tx = await program.methods
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
        return await program.account.pool.fetch(poolPda);
    }

    /**
     * Get user position
     */
    async getUserPosition(poolId: BN, user: PublicKey): Promise<any> {
        const program = this.getProgram();
        const [userPositionPda] = this.getUserPositionPda(poolId, user);

        try {
            return await program.account.userPosition.fetch(userPositionPda);
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

        const tx = await program.methods
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

        const tx = await program.methods
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

        const tx = await program.methods
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

        const tx = await program.methods
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

    /**
     * Get duel state
     */
    async getDuel(duelId: BN): Promise<any> {
        const program = this.getProgram();
        const [duelPda] = this.getDuelPda(duelId);
        return await program.account.duel.fetch(duelPda);
    }
}

export default new AnchorProgramService();
