import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

/**
 * Creates and sends a SOL transfer transaction for duel deposit
 * @param connection Solana connection
 * @param fromPublicKey Sender's public key
 * @param toPublicKey Recipient's public key (server wallet)
 * @param amountSOL Amount in SOL
 * @param sendTransaction Function from wallet adapter to send transaction
 * @returns Transaction signature
 */
export async function sendDuelDeposit(
    connection: Connection,
    fromPublicKey: PublicKey,
    toPublicKey: PublicKey,
    amountSOL: number,
    sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
): Promise<string> {
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create transaction
    const transaction = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: fromPublicKey,
    });

    // Add transfer instruction
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
    transaction.add(
        SystemProgram.transfer({
            fromPubkey: fromPublicKey,
            toPubkey: toPublicKey,
            lamports,
        })
    );

    // Send transaction
    const signature = await sendTransaction(transaction, connection);

    // Wait for confirmation
    await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
    }, 'confirmed');

    return signature;
}

/**
 * Monitors transaction confirmation status
 * @param connection Solana connection
 * @param signature Transaction signature
 * @param maxRetries Maximum number of retries
 * @returns True if confirmed, false otherwise
 */
export async function waitForConfirmation(
    connection: Connection,
    signature: string,
    maxRetries: number = 30
): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        const status = await connection.getSignatureStatus(signature);

        if (status?.value?.confirmationStatus === 'confirmed' ||
            status?.value?.confirmationStatus === 'finalized') {
            return true;
        }

        if (status?.value?.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }

        // Wait 1 second before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
}
