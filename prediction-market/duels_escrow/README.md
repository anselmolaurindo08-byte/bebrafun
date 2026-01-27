# Duels Escrow Smart Contract

Solana smart contract for managing escrow in the Prediction Market Duels module.

## Overview

This smart contract manages the escrow system for 1v1 duels using the $PREDICT token on Solana. It holds tokens during active duels and distributes them to winners or refunds players when duels are cancelled.

## Features

- ✅ **PDA-based Security** - Program Derived Addresses prevent unauthorized access
- ✅ **6 Core Functions** - Initialize, deposit, release, transfer, withdraw, cancel
- ✅ **Event Emissions** - All operations emit events for tracking
- ✅ **Comprehensive Error Handling** - Clear error messages for debugging
- ✅ **Emergency Functions** - Withdraw and cancel for edge cases
- ✅ **Full Test Coverage** - TypeScript test suite with 8+ test cases

## Architecture

```
┌─────────────────────────────────────┐
│   Duels Escrow Program (Rust)       │
├─────────────────────────────────────┤
│                                     │
│  1. initialize_escrow               │
│  2. deposit_to_escrow               │
│  3. release_to_winner               │
│  4. transfer_loser_tokens           │
│  5. withdraw_unclaimed              │
│  6. cancel_escrow                   │
│                                     │
└─────────────────────────────────────┘
```

## Prerequisites

Before deploying, ensure you have:

1. **Rust** - Install from https://rustup.rs/
2. **Solana CLI** - Install from https://docs.solana.com/cli/install-solana-cli-tools
3. **Anchor Framework** - Install from https://www.anchor-lang.com/docs/installation
4. **Node.js & Yarn** - For running tests

### Installation

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Verify installations
rustc --version
solana --version
anchor --version
```

## Project Structure

```
duels_escrow/
├── programs/
│   └── duels_escrow/
│       ├── src/
│       │   └── lib.rs          # Main smart contract
│       └── Cargo.toml
├── tests/
│   └── duels_escrow.ts         # TypeScript tests
├── Anchor.toml                 # Anchor configuration
├── Cargo.toml
├── package.json
└── README.md
```

## Smart Contract Functions

### 1. initialize_escrow

Creates a new escrow account for a duel.

**Parameters:**
- `duel_id: u64` - Unique duel identifier
- `total_amount: u64` - Total amount to be escrowed
- `resolver: Pubkey` - Authority who can resolve the duel

**Accounts:**
- `escrow_account` - PDA account to store escrow data
- `authority` - Signer who pays for account creation
- `player_1` - First player's address
- `player_2` - Second player's address

### 2. deposit_to_escrow

Deposits tokens from a player to the escrow.

**Parameters:**
- `amount: u64` - Amount to deposit
- `player_number: u8` - Player number (1 or 2)

**Accounts:**
- `escrow_account` - Escrow account
- `player_token_account` - Player's token account
- `escrow_token_account` - Escrow's token account
- `player` - Player signer

### 3. release_to_winner

Releases tokens to the winner.

**Parameters:**
- `winner_number: u8` - Winner player number (1 or 2)
- `winner_amount: u64` - Amount to release

**Accounts:**
- `escrow_account` - Escrow account
- `escrow_token_account` - Escrow's token account
- `winner_token_account` - Winner's token account
- `escrow_authority` - PDA authority
- `winner` - Winner's address
- `authority` - Resolver signer

### 4. transfer_loser_tokens

Transfers loser's tokens to the winner.

**Parameters:**
- `winner_number: u8` - Winner player number (1 or 2)

**Accounts:**
- Same as `release_to_winner`

### 5. withdraw_unclaimed

Emergency function to withdraw unclaimed tokens (admin only).

**Accounts:**
- `escrow_account` - Escrow account
- `escrow_token_account` - Escrow's token account
- `authority_token_account` - Authority's token account
- `escrow_authority` - PDA authority
- `authority` - Resolver signer

### 6. cancel_escrow

Cancels escrow and refunds both players.

**Accounts:**
- `escrow_account` - Escrow account
- `escrow_token_account` - Escrow's token account
- `player_1_token_account` - Player 1's token account
- `player_2_token_account` - Player 2's token account
- `escrow_authority` - PDA authority
- `authority` - Resolver signer

## Building and Testing

### Build the Contract

```bash
cd duels_escrow
anchor build
```

### Get Program ID

```bash
solana-keygen pubkey target/deploy/duels_escrow-keypair.json
```

### Update Program ID

Replace the program ID in:
1. `programs/duels_escrow/src/lib.rs` - Line 5: `declare_id!("YOUR_PROGRAM_ID")`
2. `Anchor.toml` - Update all program IDs

### Run Tests

```bash
# Install dependencies
yarn install

# Run tests
anchor test
```

## Deployment

### Deploy to Devnet

```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Airdrop SOL for deployment
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet
```

### Deploy to Mainnet

```bash
# Configure Solana CLI for mainnet
solana config set --url mainnet-beta

# Deploy (requires SOL for deployment)
anchor deploy --provider.cluster mainnet-beta
```

## Security Considerations

1. **PDA Authority** - Uses Program Derived Addresses for escrow authority to prevent unauthorized access
2. **Signer Verification** - All functions verify signers are authorized
3. **Amount Validation** - Validates all amounts before transfers
4. **Status Checks** - Ensures escrow is in correct status before operations
5. **Emergency Functions** - Implements withdrawal and cancellation for edge cases
6. **Audit Trail** - All operations emit events for tracking

## Events

All operations emit events for frontend tracking:

- `EscrowInitialized` - Escrow created
- `TokensDeposited` - Player deposited tokens
- `TokensReleased` - Winner received tokens
- `LoserTokensTransferred` - Loser's tokens transferred to winner
- `UnclaimedTokensWithdrawn` - Unclaimed tokens withdrawn
- `EscrowCancelled` - Escrow cancelled and refunded

## Error Codes

- `InvalidPlayerNumber` - Player number must be 1 or 2
- `InvalidAmount` - Amount must be greater than 0
- `EscrowNotActive` - Escrow is not in active status
- `UnauthorizedPlayer` - Player is not authorized
- `UnauthorizedResolver` - Resolver is not authorized
- `InvalidWinner` - Winner address is invalid
- `NoTokensToTransfer` - No tokens available to transfer
- `EscrowNotResolved` - Escrow must be resolved first
- `NoTokensToWithdraw` - No tokens available to withdraw

## Go Backend Integration

The Go backend client is located at `internal/blockchain/escrow_contract.go`.

### Usage Example

```go
import "prediction-market/internal/blockchain"

// Initialize client
escrowContract, err := blockchain.NewEscrowContract(
    "https://api.devnet.solana.com",
    "wss://api.devnet.solana.com",
    "YOUR_PROGRAM_ID",
    "YOUR_TOKEN_MINT",
)
if err != nil {
    log.Fatal(err)
}
defer escrowContract.Close()

// Initialize escrow
sig, err := escrowContract.InitializeEscrow(
    ctx,
    duelID,
    player1Pubkey,
    player2Pubkey,
    totalAmount,
    resolverPubkey,
    authorityPrivateKey,
)

// Wait for confirmation
err = escrowContract.WaitForConfirmation(ctx, sig)
```

## Configuration

Update `.env` with smart contract configuration:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
ESCROW_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
PREDICT_TOKEN_MINT=YOUR_TOKEN_MINT_HERE
RESOLVER_PRIVATE_KEY=YOUR_RESOLVER_KEY_HERE
```

## Next Steps

After deploying the smart contract:

1. ✅ Update backend configuration with program ID
2. ✅ Update duel service to use smart contract
3. ✅ Test end-to-end duel flow
4. ✅ Deploy frontend updates
5. ✅ Monitor transaction logs

## Support

For issues or questions:
- Check the test suite in `tests/duels_escrow.ts`
- Review error codes in `lib.rs`
- Verify account structures match expected format

## License

MIT
