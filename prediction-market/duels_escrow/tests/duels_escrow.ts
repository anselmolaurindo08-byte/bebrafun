import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DuelsEscrow } from "../target/types/duels_escrow";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("duels_escrow", () => {
    // Configure the client to use the local cluster
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.DuelsEscrow as Program<DuelsEscrow>;

    let tokenMint: PublicKey;
    let player1: Keypair;
    let player2: Keypair;
    let resolver: Keypair;
    let escrowTokenAccount: PublicKey;
    let player1TokenAccount: PublicKey;
    let player2TokenAccount: PublicKey;
    let resolverTokenAccount: PublicKey;
    let escrowPDA: PublicKey;
    let escrowBump: number;

    const duelId = new anchor.BN(Date.now());

    before(async () => {
        // Generate keypairs
        player1 = Keypair.generate();
        player2 = Keypair.generate();
        resolver = Keypair.generate();

        // Airdrop SOL to all accounts
        const airdropAmount = 2 * anchor.web3.LAMPORTS_PER_SOL;

        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(player1.publicKey, airdropAmount)
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(player2.publicKey, airdropAmount)
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(resolver.publicKey, airdropAmount)
        );

        // Create token mint
        tokenMint = await createMint(
            provider.connection,
            provider.wallet.payer,
            provider.wallet.publicKey,
            null,
            6 // 6 decimals
        );

        console.log("Token Mint:", tokenMint.toBase58());

        // Find escrow PDA
        [escrowPDA, escrowBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), duelId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        console.log("Escrow PDA:", escrowPDA.toBase58());

        // Create token accounts
        player1TokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            player1.publicKey
        );

        player2TokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            player2.publicKey
        );

        escrowTokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            escrowPDA,
            undefined,
            TOKEN_PROGRAM_ID
        );

        resolverTokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            resolver.publicKey
        );

        // Mint tokens to players
        await mintTo(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            player1TokenAccount,
            provider.wallet.publicKey,
            1000_000000 // 1000 tokens
        );

        await mintTo(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            player2TokenAccount,
            provider.wallet.publicKey,
            1000_000000 // 1000 tokens
        );

        console.log("Setup complete!");
    });

    it("Initialize escrow", async () => {
        const totalAmount = new anchor.BN(200_000000); // 200 tokens

        const tx = await program.methods
            .initializeEscrow(duelId, totalAmount, resolver.publicKey)
            .accounts({
                escrowAccount: escrowPDA,
                authority: provider.wallet.publicKey,
                player1: player1.publicKey,
                player2: player2.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log("Initialize escrow tx:", tx);

        // Fetch escrow account
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);

        assert.equal(escrowAccount.duelId.toString(), duelId.toString());
        assert.equal(escrowAccount.totalAmount.toString(), totalAmount.toString());
        assert.equal(escrowAccount.player1.toBase58(), player1.publicKey.toBase58());
        assert.equal(escrowAccount.player2.toBase58(), player2.publicKey.toBase58());
        assert.equal(escrowAccount.player1Amount.toString(), "0");
        assert.equal(escrowAccount.player2Amount.toString(), "0");
        assert.equal(escrowAccount.resolver.toBase58(), resolver.publicKey.toBase58());
    });

    it("Player 1 deposits to escrow", async () => {
        const depositAmount = new anchor.BN(100_000000); // 100 tokens

        const tx = await program.methods
            .depositToEscrow(depositAmount, 1)
            .accounts({
                escrowAccount: escrowPDA,
                playerTokenAccount: player1TokenAccount,
                escrowTokenAccount: escrowTokenAccount,
                player: player1.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player1])
            .rpc();

        console.log("Player 1 deposit tx:", tx);

        // Verify escrow account updated
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
        assert.equal(escrowAccount.player1Amount.toString(), depositAmount.toString());

        // Verify token transfer
        const escrowTokenAccountInfo = await getAccount(provider.connection, escrowTokenAccount);
        assert.equal(escrowTokenAccountInfo.amount.toString(), depositAmount.toString());
    });

    it("Player 2 deposits to escrow", async () => {
        const depositAmount = new anchor.BN(100_000000); // 100 tokens

        const tx = await program.methods
            .depositToEscrow(depositAmount, 2)
            .accounts({
                escrowAccount: escrowPDA,
                playerTokenAccount: player2TokenAccount,
                escrowTokenAccount: escrowTokenAccount,
                player: player2.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        console.log("Player 2 deposit tx:", tx);

        // Verify escrow account updated
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
        assert.equal(escrowAccount.player2Amount.toString(), depositAmount.toString());

        // Verify token transfer
        const escrowTokenAccountInfo = await getAccount(provider.connection, escrowTokenAccount);
        assert.equal(escrowTokenAccountInfo.amount.toString(), "200000000"); // 200 tokens total
    });

    it("Release tokens to winner (Player 1)", async () => {
        const winnerAmount = new anchor.BN(100_000000); // 100 tokens

        const tx = await program.methods
            .releaseToWinner(1, winnerAmount)
            .accounts({
                escrowAccount: escrowPDA,
                escrowTokenAccount: escrowTokenAccount,
                winnerTokenAccount: player1TokenAccount,
                escrowAuthority: escrowPDA,
                winner: player1.publicKey,
                authority: resolver.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([resolver])
            .rpc();

        console.log("Release to winner tx:", tx);

        // Verify escrow status changed
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
        assert.equal(escrowAccount.status.resolved !== undefined, true);
        assert.equal(escrowAccount.winner.toBase58(), player1.publicKey.toBase58());

        // Verify winner received tokens
        const player1TokenAccountInfo = await getAccount(provider.connection, player1TokenAccount);
        // Player 1 had 900 tokens left after deposit, now should have 1000
        assert.equal(player1TokenAccountInfo.amount.toString(), "1000000000");
    });

    it("Transfer loser tokens to winner", async () => {
        // Create new escrow for this test
        const newDuelId = new anchor.BN(Date.now() + 1000);
        const [newEscrowPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), newDuelId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const newEscrowTokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            newEscrowPDA,
            undefined,
            TOKEN_PROGRAM_ID
        );

        // Initialize new escrow
        await program.methods
            .initializeEscrow(newDuelId, new anchor.BN(200_000000), resolver.publicKey)
            .accounts({
                escrowAccount: newEscrowPDA,
                authority: provider.wallet.publicKey,
                player1: player1.publicKey,
                player2: player2.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        // Both players deposit
        await program.methods
            .depositToEscrow(new anchor.BN(100_000000), 1)
            .accounts({
                escrowAccount: newEscrowPDA,
                playerTokenAccount: player1TokenAccount,
                escrowTokenAccount: newEscrowTokenAccount,
                player: player1.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player1])
            .rpc();

        await program.methods
            .depositToEscrow(new anchor.BN(100_000000), 2)
            .accounts({
                escrowAccount: newEscrowPDA,
                playerTokenAccount: player2TokenAccount,
                escrowTokenAccount: newEscrowTokenAccount,
                player: player2.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        // Transfer loser tokens to winner
        const tx = await program.methods
            .transferLoserTokens(1)
            .accounts({
                escrowAccount: newEscrowPDA,
                escrowTokenAccount: newEscrowTokenAccount,
                winnerTokenAccount: player1TokenAccount,
                escrowAuthority: newEscrowPDA,
                winner: player1.publicKey,
                authority: resolver.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([resolver])
            .rpc();

        console.log("Transfer loser tokens tx:", tx);

        // Verify escrow resolved
        const escrowAccount = await program.account.escrowAccount.fetch(newEscrowPDA);
        assert.equal(escrowAccount.status.resolved !== undefined, true);
        assert.equal(escrowAccount.winner.toBase58(), player1.publicKey.toBase58());
    });

    it("Cancel escrow and refund players", async () => {
        // Create new escrow for this test
        const newDuelId = new anchor.BN(Date.now() + 2000);
        const [newEscrowPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), newDuelId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const newEscrowTokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            newEscrowPDA,
            undefined,
            TOKEN_PROGRAM_ID
        );

        // Initialize new escrow
        await program.methods
            .initializeEscrow(newDuelId, new anchor.BN(200_000000), resolver.publicKey)
            .accounts({
                escrowAccount: newEscrowPDA,
                authority: provider.wallet.publicKey,
                player1: player1.publicKey,
                player2: player2.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        // Both players deposit
        await program.methods
            .depositToEscrow(new anchor.BN(50_000000), 1)
            .accounts({
                escrowAccount: newEscrowPDA,
                playerTokenAccount: player1TokenAccount,
                escrowTokenAccount: newEscrowTokenAccount,
                player: player1.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player1])
            .rpc();

        await program.methods
            .depositToEscrow(new anchor.BN(50_000000), 2)
            .accounts({
                escrowAccount: newEscrowPDA,
                playerTokenAccount: player2TokenAccount,
                escrowTokenAccount: newEscrowTokenAccount,
                player: player2.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        // Get balances before cancel
        const player1Before = await getAccount(provider.connection, player1TokenAccount);
        const player2Before = await getAccount(provider.connection, player2TokenAccount);

        // Cancel escrow
        const tx = await program.methods
            .cancelEscrow()
            .accounts({
                escrowAccount: newEscrowPDA,
                escrowTokenAccount: newEscrowTokenAccount,
                player1TokenAccount: player1TokenAccount,
                player2TokenAccount: player2TokenAccount,
                escrowAuthority: newEscrowPDA,
                authority: resolver.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([resolver])
            .rpc();

        console.log("Cancel escrow tx:", tx);

        // Verify escrow cancelled
        const escrowAccount = await program.account.escrowAccount.fetch(newEscrowPDA);
        assert.equal(escrowAccount.status.cancelled !== undefined, true);

        // Verify players got refunds
        const player1After = await getAccount(provider.connection, player1TokenAccount);
        const player2After = await getAccount(provider.connection, player2TokenAccount);

        assert.equal(
            player1After.amount.toString(),
            (BigInt(player1Before.amount.toString()) + BigInt(50_000000)).toString()
        );
        assert.equal(
            player2After.amount.toString(),
            (BigInt(player2Before.amount.toString()) + BigInt(50_000000)).toString()
        );
    });

    it("Fails when unauthorized player tries to deposit", async () => {
        const newDuelId = new anchor.BN(Date.now() + 3000);
        const [newEscrowPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), newDuelId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const newEscrowTokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            newEscrowPDA,
            undefined,
            TOKEN_PROGRAM_ID
        );

        await program.methods
            .initializeEscrow(newDuelId, new anchor.BN(200_000000), resolver.publicKey)
            .accounts({
                escrowAccount: newEscrowPDA,
                authority: provider.wallet.publicKey,
                player1: player1.publicKey,
                player2: player2.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        // Try to deposit as wrong player (player2 trying to deposit as player1)
        try {
            await program.methods
                .depositToEscrow(new anchor.BN(100_000000), 1)
                .accounts({
                    escrowAccount: newEscrowPDA,
                    playerTokenAccount: player2TokenAccount,
                    escrowTokenAccount: newEscrowTokenAccount,
                    player: player2.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([player2])
                .rpc();

            assert.fail("Should have failed with unauthorized player error");
        } catch (err) {
            assert.include(err.toString(), "UnauthorizedPlayer");
        }
    });

    it("Fails when unauthorized resolver tries to release tokens", async () => {
        const newDuelId = new anchor.BN(Date.now() + 4000);
        const [newEscrowPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), newDuelId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const newEscrowTokenAccount = await createAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            newEscrowPDA,
            undefined,
            TOKEN_PROGRAM_ID
        );

        await program.methods
            .initializeEscrow(newDuelId, new anchor.BN(200_000000), resolver.publicKey)
            .accounts({
                escrowAccount: newEscrowPDA,
                authority: provider.wallet.publicKey,
                player1: player1.publicKey,
                player2: player2.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        await program.methods
            .depositToEscrow(new anchor.BN(100_000000), 1)
            .accounts({
                escrowAccount: newEscrowPDA,
                playerTokenAccount: player1TokenAccount,
                escrowTokenAccount: newEscrowTokenAccount,
                player: player1.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player1])
            .rpc();

        // Try to release as unauthorized user (player1 instead of resolver)
        try {
            await program.methods
                .releaseToWinner(1, new anchor.BN(100_000000))
                .accounts({
                    escrowAccount: newEscrowPDA,
                    escrowTokenAccount: newEscrowTokenAccount,
                    winnerTokenAccount: player1TokenAccount,
                    escrowAuthority: newEscrowPDA,
                    winner: player1.publicKey,
                    authority: player1.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([player1])
                .rpc();

            assert.fail("Should have failed with unauthorized resolver error");
        } catch (err) {
            assert.include(err.toString(), "UnauthorizedResolver");
        }
    });
});
