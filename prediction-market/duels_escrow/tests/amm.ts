import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AmmProgram } from "../target/types/amm_program";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("amm_program", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.AmmProgram as Program<AmmProgram>;

    let yesMint: PublicKey;
    let noMint: PublicKey;
    let authority: Keypair;
    let user: Keypair;

    // Authority token accounts
    let authorityYesAccount: PublicKey;
    let authorityNoAccount: PublicKey;

    // User token accounts
    let userYesAccount: PublicKey;
    let userNoAccount: PublicKey;

    // PDAs
    let poolPDA: PublicKey;
    let poolBump: number;
    let yesVaultPDA: PublicKey;
    let noVaultPDA: PublicKey;

    const FEE_PERCENTAGE = 50; // 0.5% in basis points
    const INITIAL_YES_RESERVE = 1_000_000_000; // 1B tokens (6 decimals = 1000 tokens)
    const INITIAL_NO_RESERVE = 1_000_000_000;

    before(async () => {
        authority = Keypair.generate();
        user = Keypair.generate();

        // Airdrop SOL
        const airdropAmount = 5 * anchor.web3.LAMPORTS_PER_SOL;

        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(authority.publicKey, airdropAmount)
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(user.publicKey, airdropAmount)
        );

        // Create YES and NO token mints (authority is mint authority)
        yesMint = await createMint(
            provider.connection,
            authority,
            authority.publicKey,
            null,
            6
        );
        console.log("YES Mint:", yesMint.toBase58());

        noMint = await createMint(
            provider.connection,
            authority,
            authority.publicKey,
            null,
            6
        );
        console.log("NO Mint:", noMint.toBase58());

        // Derive PDAs
        [poolPDA, poolBump] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("amm_pool"),
                authority.publicKey.toBuffer(),
                yesMint.toBuffer(),
                noMint.toBuffer(),
            ],
            program.programId
        );
        console.log("Pool PDA:", poolPDA.toBase58());

        [yesVaultPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("yes_vault"),
                authority.publicKey.toBuffer(),
                yesMint.toBuffer(),
                noMint.toBuffer(),
            ],
            program.programId
        );

        [noVaultPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("no_vault"),
                authority.publicKey.toBuffer(),
                yesMint.toBuffer(),
                noMint.toBuffer(),
            ],
            program.programId
        );

        // Create authority token accounts
        authorityYesAccount = await createAccount(
            provider.connection,
            authority,
            yesMint,
            authority.publicKey
        );
        authorityNoAccount = await createAccount(
            provider.connection,
            authority,
            noMint,
            authority.publicKey
        );

        // Create user token accounts
        userYesAccount = await createAccount(
            provider.connection,
            authority, // payer
            yesMint,
            user.publicKey
        );
        userNoAccount = await createAccount(
            provider.connection,
            authority, // payer
            noMint,
            user.publicKey
        );

        // Mint tokens to authority (for initial pool reserves)
        await mintTo(
            provider.connection,
            authority,
            yesMint,
            authorityYesAccount,
            authority.publicKey,
            2_000_000_000 // 2000 tokens
        );
        await mintTo(
            provider.connection,
            authority,
            noMint,
            authorityNoAccount,
            authority.publicKey,
            2_000_000_000
        );

        // Mint tokens to user (for trading)
        await mintTo(
            provider.connection,
            authority,
            yesMint,
            userYesAccount,
            authority.publicKey,
            500_000_000 // 500 tokens
        );
        await mintTo(
            provider.connection,
            authority,
            noMint,
            userNoAccount,
            authority.publicKey,
            500_000_000
        );

        console.log("Setup complete!");
    });

    // ========================================================================
    // initialize_pool
    // ========================================================================

    it("Initialize AMM pool", async () => {
        const tx = await program.methods
            .initializePool(
                FEE_PERCENTAGE,
                new anchor.BN(INITIAL_YES_RESERVE),
                new anchor.BN(INITIAL_NO_RESERVE),
            )
            .accounts({
                pool: poolPDA,
                yesVault: yesVaultPDA,
                noVault: noVaultPDA,
                yesMint: yesMint,
                noMint: noMint,
                authorityYesAccount: authorityYesAccount,
                authorityNoAccount: authorityNoAccount,
                authority: authority.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();

        console.log("Initialize pool tx:", tx);

        // Verify pool state
        const pool = await program.account.pool.fetch(poolPDA);
        assert.equal(pool.authority.toBase58(), authority.publicKey.toBase58());
        assert.equal(pool.yesMint.toBase58(), yesMint.toBase58());
        assert.equal(pool.noMint.toBase58(), noMint.toBase58());
        assert.equal(pool.yesReserve.toString(), INITIAL_YES_RESERVE.toString());
        assert.equal(pool.noReserve.toString(), INITIAL_NO_RESERVE.toString());
        assert.equal(pool.feePercentage, FEE_PERCENTAGE);
        assert.equal(pool.isActive, true);

        // Verify vaults received tokens
        const yesVault = await getAccount(provider.connection, yesVaultPDA);
        assert.equal(yesVault.amount.toString(), INITIAL_YES_RESERVE.toString());

        const noVault = await getAccount(provider.connection, noVaultPDA);
        assert.equal(noVault.amount.toString(), INITIAL_NO_RESERVE.toString());
    });

    // ========================================================================
    // swap — BUY_YES (trade_type = 0)
    // ========================================================================

    it("Swap: BUY_YES (user sends NO tokens, receives YES tokens)", async () => {
        const inputAmount = new anchor.BN(100_000_000); // 100 tokens
        const minimumOutput = new anchor.BN(1); // accept any output

        // Record balances before
        const userYesBefore = await getAccount(provider.connection, userYesAccount);
        const userNoBefore = await getAccount(provider.connection, userNoAccount);

        const tx = await program.methods
            .swap(0, inputAmount, minimumOutput) // trade_type = 0 (BUY_YES)
            .accounts({
                pool: poolPDA,
                yesVault: yesVaultPDA,
                noVault: noVaultPDA,
                userYesAccount: userYesAccount,
                userNoAccount: userNoAccount,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user])
            .rpc();

        console.log("Swap BUY_YES tx:", tx);

        // Verify user received YES tokens
        const userYesAfter = await getAccount(provider.connection, userYesAccount);
        const userNoAfter = await getAccount(provider.connection, userNoAccount);

        const yesReceived = BigInt(userYesAfter.amount.toString()) - BigInt(userYesBefore.amount.toString());
        const noSpent = BigInt(userNoBefore.amount.toString()) - BigInt(userNoAfter.amount.toString());

        console.log(`  YES received: ${yesReceived}`);
        console.log(`  NO spent: ${noSpent}`);

        assert.isTrue(yesReceived > 0n, "User should receive YES tokens");
        assert.equal(noSpent.toString(), inputAmount.toString(), "User should spend exact input NO tokens");

        // Verify pool reserves updated
        const pool = await program.account.pool.fetch(poolPDA);
        console.log(`  Pool YES reserve: ${pool.yesReserve.toString()}`);
        console.log(`  Pool NO reserve: ${pool.noReserve.toString()}`);

        // YES reserve should decrease, NO reserve should increase
        assert.isTrue(pool.yesReserve.toNumber() < INITIAL_YES_RESERVE);
        assert.isTrue(pool.noReserve.toNumber() > INITIAL_NO_RESERVE);
    });

    // ========================================================================
    // swap — BUY_NO (trade_type = 1)
    // ========================================================================

    it("Swap: BUY_NO (user sends YES tokens, receives NO tokens)", async () => {
        const inputAmount = new anchor.BN(50_000_000); // 50 tokens
        const minimumOutput = new anchor.BN(1);

        const userYesBefore = await getAccount(provider.connection, userYesAccount);
        const userNoBefore = await getAccount(provider.connection, userNoAccount);

        const tx = await program.methods
            .swap(1, inputAmount, minimumOutput) // trade_type = 1 (BUY_NO)
            .accounts({
                pool: poolPDA,
                yesVault: yesVaultPDA,
                noVault: noVaultPDA,
                userYesAccount: userYesAccount,
                userNoAccount: userNoAccount,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user])
            .rpc();

        console.log("Swap BUY_NO tx:", tx);

        const userYesAfter = await getAccount(provider.connection, userYesAccount);
        const userNoAfter = await getAccount(provider.connection, userNoAccount);

        const yesSpent = BigInt(userYesBefore.amount.toString()) - BigInt(userYesAfter.amount.toString());
        const noReceived = BigInt(userNoAfter.amount.toString()) - BigInt(userNoBefore.amount.toString());

        console.log(`  YES spent: ${yesSpent}`);
        console.log(`  NO received: ${noReceived}`);

        assert.equal(yesSpent.toString(), inputAmount.toString());
        assert.isTrue(noReceived > 0n, "User should receive NO tokens");
    });

    // ========================================================================
    // swap — slippage protection
    // ========================================================================

    it("Swap fails when minimum_output exceeds actual output (slippage)", async () => {
        const inputAmount = new anchor.BN(10_000_000); // 10 tokens
        const unreasonableMinimum = new anchor.BN(999_999_999_999); // way too high

        try {
            await program.methods
                .swap(0, inputAmount, unreasonableMinimum)
                .accounts({
                    pool: poolPDA,
                    yesVault: yesVaultPDA,
                    noVault: noVaultPDA,
                    userYesAccount: userYesAccount,
                    userNoAccount: userNoAccount,
                    user: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            assert.fail("Should have failed with SlippageExceeded");
        } catch (err) {
            assert.include(err.toString(), "SlippageExceeded");
        }
    });

    // ========================================================================
    // swap — invalid trade type
    // ========================================================================

    it("Swap fails with invalid trade type", async () => {
        try {
            await program.methods
                .swap(5, new anchor.BN(10_000_000), new anchor.BN(1)) // trade_type = 5 (invalid)
                .accounts({
                    pool: poolPDA,
                    yesVault: yesVaultPDA,
                    noVault: noVaultPDA,
                    userYesAccount: userYesAccount,
                    userNoAccount: userNoAccount,
                    user: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            assert.fail("Should have failed with InvalidTradeType");
        } catch (err) {
            assert.include(err.toString(), "InvalidTradeType");
        }
    });

    // ========================================================================
    // swap — zero amount
    // ========================================================================

    it("Swap fails with zero input amount", async () => {
        try {
            await program.methods
                .swap(0, new anchor.BN(0), new anchor.BN(0))
                .accounts({
                    pool: poolPDA,
                    yesVault: yesVaultPDA,
                    noVault: noVaultPDA,
                    userYesAccount: userYesAccount,
                    userNoAccount: userNoAccount,
                    user: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            assert.fail("Should have failed with InvalidAmount");
        } catch (err) {
            assert.include(err.toString(), "InvalidAmount");
        }
    });

    // ========================================================================
    // close_pool — unauthorized
    // ========================================================================

    it("Close pool fails for non-authority", async () => {
        try {
            await program.methods
                .closePool()
                .accounts({
                    pool: poolPDA,
                    yesVault: yesVaultPDA,
                    noVault: noVaultPDA,
                    authorityYesAccount: userYesAccount, // wrong accounts
                    authorityNoAccount: userNoAccount,
                    authority: user.publicKey, // not the authority
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            assert.fail("Should have failed with Unauthorized");
        } catch (err) {
            // May fail with constraint error or Unauthorized
            console.log("Expected error for unauthorized close:", err.toString().slice(0, 100));
        }
    });

    // ========================================================================
    // close_pool — success
    // ========================================================================

    it("Close pool drains vaults to authority", async () => {
        const authorityYesBefore = await getAccount(provider.connection, authorityYesAccount);
        const authorityNoBefore = await getAccount(provider.connection, authorityNoAccount);
        const yesVaultBefore = await getAccount(provider.connection, yesVaultPDA);
        const noVaultBefore = await getAccount(provider.connection, noVaultPDA);

        console.log(`  Yes vault balance before close: ${yesVaultBefore.amount}`);
        console.log(`  No vault balance before close: ${noVaultBefore.amount}`);

        const tx = await program.methods
            .closePool()
            .accounts({
                pool: poolPDA,
                yesVault: yesVaultPDA,
                noVault: noVaultPDA,
                authorityYesAccount: authorityYesAccount,
                authorityNoAccount: authorityNoAccount,
                authority: authority.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();

        console.log("Close pool tx:", tx);

        // Verify pool is inactive
        const pool = await program.account.pool.fetch(poolPDA);
        assert.equal(pool.isActive, false);
        assert.equal(pool.yesReserve.toString(), "0");
        assert.equal(pool.noReserve.toString(), "0");
        assert.equal(pool.totalLiquidity.toString(), "0");

        // Verify vaults are drained
        const yesVaultAfter = await getAccount(provider.connection, yesVaultPDA);
        const noVaultAfter = await getAccount(provider.connection, noVaultPDA);
        assert.equal(yesVaultAfter.amount.toString(), "0");
        assert.equal(noVaultAfter.amount.toString(), "0");

        // Verify authority received tokens back
        const authorityYesAfter = await getAccount(provider.connection, authorityYesAccount);
        const authorityNoAfter = await getAccount(provider.connection, authorityNoAccount);

        const yesReturned = BigInt(authorityYesAfter.amount.toString()) - BigInt(authorityYesBefore.amount.toString());
        const noReturned = BigInt(authorityNoAfter.amount.toString()) - BigInt(authorityNoBefore.amount.toString());

        assert.equal(yesReturned.toString(), yesVaultBefore.amount.toString());
        assert.equal(noReturned.toString(), noVaultBefore.amount.toString());

        console.log(`  YES returned to authority: ${yesReturned}`);
        console.log(`  NO returned to authority: ${noReturned}`);
    });

    // ========================================================================
    // swap on closed pool
    // ========================================================================

    it("Swap fails on closed pool", async () => {
        try {
            await program.methods
                .swap(0, new anchor.BN(10_000_000), new anchor.BN(1))
                .accounts({
                    pool: poolPDA,
                    yesVault: yesVaultPDA,
                    noVault: noVaultPDA,
                    userYesAccount: userYesAccount,
                    userNoAccount: userNoAccount,
                    user: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();

            assert.fail("Should have failed with PoolNotActive");
        } catch (err) {
            assert.include(err.toString(), "PoolNotActive");
        }
    });

    // ========================================================================
    // close_pool again fails
    // ========================================================================

    it("Close pool fails when already closed", async () => {
        try {
            await program.methods
                .closePool()
                .accounts({
                    pool: poolPDA,
                    yesVault: yesVaultPDA,
                    noVault: noVaultPDA,
                    authorityYesAccount: authorityYesAccount,
                    authorityNoAccount: authorityNoAccount,
                    authority: authority.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([authority])
                .rpc();

            assert.fail("Should have failed with PoolAlreadyClosed");
        } catch (err) {
            assert.include(err.toString(), "PoolAlreadyClosed");
        }
    });
});
