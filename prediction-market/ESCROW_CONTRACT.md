# Quick Start Guide - Escrow Smart Contract

## What Was Created

✅ **Solana Smart Contract** (`duels_escrow/programs/duels_escrow/src/lib.rs`)
- 6 escrow functions (initialize, deposit, release, transfer, withdraw, cancel)
- PDA-based security
- Event emissions
- Comprehensive error handling

✅ **Test Suite** (`duels_escrow/tests/duels_escrow.ts`)
- 8 test cases covering all functions
- Security tests for unauthorized access

✅ **Go Backend Client** (`internal/blockchain/escrow_contract.go`)
- Ready to integrate with duel service
- Transaction building and signing

✅ **Documentation**
- README.md - Full documentation
- DEPLOYMENT.md - Step-by-step deployment guide

## Next Steps (Required)

### 1. Install Tools

You need to install Anchor CLI and Solana tools to build and deploy:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### 2. Build and Test

```bash
cd duels_escrow

# Install Node dependencies
yarn install

# Build smart contract
anchor build

# Get program ID
solana-keygen pubkey target/deploy/duels_escrow-keypair.json
# Save this program ID!

# Update program ID in:
# - programs/duels_escrow/src/lib.rs (line 5)
# - Anchor.toml (all program IDs)

# Rebuild
anchor build

# Run tests
anchor test
```

### 3. Deploy to Devnet

```bash
# Configure for devnet
solana config set --url devnet

# Get SOL for deployment
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet

# Verify
solana program show YOUR_PROGRAM_ID --url devnet
```

### 4. Update Backend Config

Add to `.env`:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
ESCROW_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
PREDICT_TOKEN_MINT=YOUR_TOKEN_MINT_HERE
RESOLVER_PRIVATE_KEY=YOUR_RESOLVER_KEY_HERE
```

### 5. Integrate with Duel Service

The Go client is ready at `internal/blockchain/escrow_contract.go`.

Update `duel_service.go` to call smart contract functions when:
- Creating duels → `InitializeEscrow()`
- Players deposit → `DepositToEscrow()`
- Resolving duels → `ReleaseToWinner()` or `TransferLoserTokens()`
- Cancelling duels → `CancelEscrow()`

## File Locations

```
prediction-market/
├── duels_escrow/                    # Smart contract project
│   ├── programs/duels_escrow/src/
│   │   └── lib.rs                   # Main contract (600+ lines)
│   ├── tests/
│   │   └── duels_escrow.ts          # Tests (400+ lines)
│   ├── README.md                    # Full documentation
│   └── DEPLOYMENT.md                # Deployment guide
│
├── internal/blockchain/
│   └── escrow_contract.go           # Go client (500+ lines)
│
└── ESCROW_CONTRACT.md               # This file
```

## Documentation

- **Full Documentation**: [duels_escrow/README.md](duels_escrow/README.md)
- **Deployment Guide**: [duels_escrow/DEPLOYMENT.md](duels_escrow/DEPLOYMENT.md)
- **Walkthrough**: See artifacts directory

## Support

If you encounter issues:
1. Check [DEPLOYMENT.md](duels_escrow/DEPLOYMENT.md) troubleshooting section
2. Verify all tools installed correctly
3. Ensure program ID updated in all files
4. Check Solana devnet status

## Status

- [x] Smart contract implemented
- [x] Tests written
- [x] Go client ready
- [x] Documentation complete
- [ ] **Tools installation required** (Rust, Solana CLI, Anchor)
- [ ] Build and deploy
- [ ] Backend integration
- [ ] End-to-end testing
