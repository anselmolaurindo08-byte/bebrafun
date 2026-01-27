# Deployment Guide - Duels Escrow Smart Contract

This guide walks you through deploying the Duels Escrow smart contract to Solana devnet and mainnet.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Rust installed (`rustc --version`)
- [ ] Solana CLI installed (`solana --version`)
- [ ] Anchor framework installed (`anchor --version`)
- [ ] Node.js and Yarn installed
- [ ] SOL for deployment (devnet: airdrop, mainnet: purchase)
- [ ] $PREDICT token mint address (if already deployed)

## Step 1: Install Required Tools

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

### Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### Install Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
anchor --version
```

### Install Node Dependencies

```bash
cd duels_escrow
yarn install
```

## Step 2: Generate Keypairs

### Generate Program Keypair

```bash
# This creates the program keypair
anchor build

# View the program ID
solana-keygen pubkey target/deploy/duels_escrow-keypair.json
```

**Save this program ID** - you'll need it in the next step.

### Generate Resolver Keypair (Admin)

```bash
# Generate resolver keypair for managing escrows
solana-keygen new --outfile ~/.config/solana/resolver-keypair.json

# View the resolver public key
solana-keygen pubkey ~/.config/solana/resolver-keypair.json
```

## Step 3: Update Program ID

Update the program ID in two places:

### 1. Update `lib.rs`

Edit `programs/duels_escrow/src/lib.rs`:

```rust
declare_id!("YOUR_PROGRAM_ID_HERE"); // Replace with actual program ID
```

### 2. Update `Anchor.toml`

Edit `Anchor.toml`:

```toml
[programs.localnet]
duels_escrow = "YOUR_PROGRAM_ID_HERE"

[programs.devnet]
duels_escrow = "YOUR_PROGRAM_ID_HERE"

[programs.mainnet]
duels_escrow = "YOUR_PROGRAM_ID_HERE"
```

## Step 4: Rebuild After Updating Program ID

```bash
anchor build
```

## Step 5: Run Tests Locally

```bash
# Run all tests
anchor test

# Or run tests without building
anchor test --skip-build
```

Expected output:
```
  duels_escrow
    ✓ Initialize escrow
    ✓ Player 1 deposits to escrow
    ✓ Player 2 deposits to escrow
    ✓ Release tokens to winner (Player 1)
    ✓ Transfer loser tokens to winner
    ✓ Cancel escrow and refund players
    ✓ Fails when unauthorized player tries to deposit
    ✓ Fails when unauthorized resolver tries to release tokens

  8 passing
```

## Step 6: Deploy to Devnet

### Configure Solana for Devnet

```bash
solana config set --url devnet
solana config get
```

### Airdrop SOL for Deployment

```bash
# Airdrop 2 SOL to your wallet
solana airdrop 2

# Check balance
solana balance
```

### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Deploying workspace: https://api.devnet.solana.com
Upgrade authority: YOUR_WALLET_ADDRESS
Deploying program "duels_escrow"...
Program path: /path/to/target/deploy/duels_escrow.so...
Program Id: YOUR_PROGRAM_ID

Deploy success
```

### Verify Deployment

```bash
# Check program account
solana program show YOUR_PROGRAM_ID --url devnet
```

## Step 7: Test on Devnet

### Update Test Configuration

Edit `tests/duels_escrow.ts` to use devnet:

```typescript
const provider = anchor.AnchorProvider.env();
// Make sure Anchor.toml has:
// [provider]
// cluster = "devnet"
```

### Run Tests on Devnet

```bash
anchor test --skip-local-validator --provider.cluster devnet
```

## Step 8: Update Backend Configuration

### Update `.env` File

Add to your backend `.env`:

```env
# Solana Devnet Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com

# Smart Contract
ESCROW_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
PREDICT_TOKEN_MINT=YOUR_TOKEN_MINT_HERE

# Resolver (Admin) Keypair
RESOLVER_PRIVATE_KEY=YOUR_RESOLVER_PRIVATE_KEY_BASE58
```

### Get Resolver Private Key

```bash
# Convert keypair to base58
cat ~/.config/solana/resolver-keypair.json | jq -r '.[0:32] | @base64'
```

## Step 9: Deploy to Mainnet (Production)

⚠️ **WARNING**: Mainnet deployment requires real SOL and should only be done after thorough testing.

### Configure Solana for Mainnet

```bash
solana config set --url mainnet-beta
solana config get
```

### Check Balance

```bash
solana balance
```

You'll need approximately 2-3 SOL for deployment.

### Deploy to Mainnet

```bash
anchor deploy --provider.cluster mainnet-beta
```

### Verify Mainnet Deployment

```bash
solana program show YOUR_PROGRAM_ID --url mainnet-beta
```

### Update Production Configuration

Update production `.env`:

```env
# Solana Mainnet Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Smart Contract
ESCROW_PROGRAM_ID=YOUR_MAINNET_PROGRAM_ID
PREDICT_TOKEN_MINT=YOUR_MAINNET_TOKEN_MINT

# Resolver (Admin) Keypair
RESOLVER_PRIVATE_KEY=YOUR_MAINNET_RESOLVER_KEY
```

## Step 10: Monitor and Verify

### Monitor Transactions

```bash
# Watch program logs
solana logs YOUR_PROGRAM_ID --url devnet

# Or for mainnet
solana logs YOUR_PROGRAM_ID --url mainnet-beta
```

### Verify with Solana Explorer

Visit:
- Devnet: https://explorer.solana.com/address/YOUR_PROGRAM_ID?cluster=devnet
- Mainnet: https://explorer.solana.com/address/YOUR_PROGRAM_ID

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
anchor clean
anchor build
```

### Deployment Fails - Insufficient Funds

```bash
# Check balance
solana balance

# Airdrop more (devnet only)
solana airdrop 2
```

### Deployment Fails - Program Already Deployed

```bash
# Upgrade existing program
anchor upgrade target/deploy/duels_escrow.so --program-id YOUR_PROGRAM_ID
```

### Test Failures

```bash
# Check Anchor.toml cluster setting
# Make sure it matches your intended cluster

# Verify program is deployed
solana program show YOUR_PROGRAM_ID
```

## Security Checklist

Before mainnet deployment:

- [ ] All tests passing
- [ ] Code reviewed by team
- [ ] Program ID updated in all files
- [ ] Resolver keypair securely stored
- [ ] Backup of all keypairs created
- [ ] Consider professional smart contract audit
- [ ] Test on devnet with real-world scenarios
- [ ] Monitor initial transactions closely

## Upgrade Process

To upgrade the program after deployment:

```bash
# Build new version
anchor build

# Upgrade on devnet
anchor upgrade target/deploy/duels_escrow.so --program-id YOUR_PROGRAM_ID --provider.cluster devnet

# Upgrade on mainnet (be careful!)
anchor upgrade target/deploy/duels_escrow.so --program-id YOUR_PROGRAM_ID --provider.cluster mainnet-beta
```

## Rollback Plan

If issues occur after deployment:

1. Keep previous version of `.so` file
2. Use `anchor upgrade` with previous version
3. Have resolver keypair backup ready
4. Monitor all active escrows before upgrade

## Next Steps

After successful deployment:

1. Update backend Go code with program ID
2. Test end-to-end duel flow
3. Deploy frontend with smart contract integration
4. Monitor transaction logs
5. Set up alerts for errors

## Support Resources

- Anchor Documentation: https://www.anchor-lang.com/docs
- Solana Documentation: https://docs.solana.com
- Solana Discord: https://discord.gg/solana
- Anchor Discord: https://discord.gg/anchorlang
