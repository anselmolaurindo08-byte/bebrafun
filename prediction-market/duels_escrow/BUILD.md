# Building and Deploying the Unified Prediction Market Contract

## Prerequisites

1. **Install Rust**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
```

2. **Install Solana CLI**:
```bash
sh -c "$(curl -sSfL https://release.solana.com/v2.1.15/install)"
```

3. **Install Anchor**:
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
```

## Build the Contract

```bash
cd prediction-market/duels_escrow
anchor build
```

This will:
- Compile all programs in `programs/` directory
- Generate IDL files in `target/idl/`
- Create `.so` binaries in `target/deploy/`

## Get Program ID

After first build:
```bash
anchor keys list
```

Copy the `prediction_market` program ID and update `Anchor.toml`:
```toml
[programs.devnet]
prediction_market = "<YOUR_PROGRAM_ID_HERE>"
```

Also update `programs/prediction_market/src/lib.rs`:
```rust
declare_id!("<YOUR_PROGRAM_ID_HERE>");
```

Then rebuild:
```bash
anchor build
```

## Deploy to Devnet

1. **Set Solana to devnet**:
```bash
solana config set --url devnet
```

2. **Create/fund wallet** (if needed):
```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana airdrop 2
```

3. **Deploy**:
```bash
anchor deploy
```

4. **Verify deployment**:
```bash
solana program show <PROGRAM_ID>
```

## Run Tests

```bash
anchor test
```

## Deploy to Mainnet

1. **Set to mainnet**:
```bash
solana config set --url mainnet-beta
```

2. **Fund wallet** (you'll need real SOL):
```bash
solana balance
```

3. **Deploy**:
```bash
anchor deploy
```

## Upgrade Program

If you need to update the program:
```bash
anchor build
anchor upgrade <PROGRAM_ID> target/deploy/prediction_market.so
```

## Common Issues

### "anchor: command not found"
```bash
# Add to PATH
export PATH="$HOME/.cargo/bin:$PATH"
# Or reinstall Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
```

### "Insufficient funds"
```bash
# Devnet
solana airdrop 2

# Mainnet
# Transfer SOL to your wallet
```

### "Program ID mismatch"
```bash
# Regenerate keys
anchor keys list
# Update Anchor.toml and lib.rs with new ID
# Rebuild
anchor build
```

## Next Steps

After successful deployment:
1. Note the program ID
2. Update backend `AnchorClient` with new program ID
3. Update frontend with new IDL
4. Test on devnet before mainnet deployment
