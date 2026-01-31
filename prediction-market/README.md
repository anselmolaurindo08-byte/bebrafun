# Prediction Market - Backend

A prediction market platform built with Go, PostgreSQL, and Solana wallet authentication.

## Features

- **Solana Wallet Authentication**: Login with Phantom, Solflare, or any Solana wallet
- **Referral System**: Multi-level referral system with invite codes
- **Virtual Currency**: Season 0 operates with virtual dollars
- **Invite Codes**: Each user receives 5 invite codes upon registration
- **Market Categories**: Politics, Sports, Crypto, Solana

## Tech Stack

- **Backend**: Go (Golang)
- **Database**: PostgreSQL
- **Authentication**: Solana Wallet + JWT
- **Web Framework**: Gin
- **ORM**: GORM

## Prerequisites

- Go 1.21 or higher
- PostgreSQL 14 or higher
- Solana wallet (Phantom, Solflare, etc.) for testing

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd prediction-market
go mod tidy
```

### 2. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE prediction_market;

# Exit psql
\q
```

Run migrations:

```bash
# Run all migrations in order
psql -U postgres -d prediction_market -f migrations/001_initial_schema.sql
# ... run other migrations as needed
psql -U postgres -d prediction_market -f migrations/010_remove_twitter_oauth.sql
```

Note: The application will auto-migrate using GORM on startup, so manual migration is optional.

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=prediction_market

# Server Configuration
SERVER_PORT=8080
JWT_SECRET=your_secret_key_change_this_in_production

# Application Settings
INITIAL_VIRTUAL_BALANCE=1000.00
INVITE_CODES_PER_USER=5

# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# Frontend Configuration (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 4. Run the Application

```bash
go run cmd/main.go
```

The server will start on `http://localhost:8080`

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/wallet` | Wallet-based login/signup |
| POST | `/auth/logout` | Logout user |
| GET | `/auth/me` | Get current authenticated user |

### Protected Endpoints (Require JWT Token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get current user profile |
| GET | `/api/user/balance` | Get virtual balance |
| GET | `/api/user/invite-codes` | Get user's invite codes |
| GET | `/api/user/referrals` | Get user's referrals |

### Authentication

Protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

## Testing the Application

### 1. Health Check

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "ok",
  "time": "2026-01-31T14:00:00Z"
}
```

### 2. Wallet Login Flow

**Request**:
```bash
curl -X POST http://localhost:8080/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "YourSolanaWalletAddressHere",
    "invite_code": "optional_invite_code"
  }'
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "wallet_address": "YourSolanaWalletAddressHere",
    "virtual_balance": 1000.00,
    "created_at": "2026-01-31T14:00:00Z"
  }
}
```

### 3. Test Protected Endpoints

```bash
# Get user profile
curl -H "Authorization: Bearer <your_token>" http://localhost:8080/api/user/profile

# Get balance
curl -H "Authorization: Bearer <your_token>" http://localhost:8080/api/user/balance

# Get invite codes
curl -H "Authorization: Bearer <your_token>" http://localhost:8080/api/user/invite-codes

# Get referrals
curl -H "Authorization: Bearer <your_token>" http://localhost:8080/api/user/referrals
```

### 4. Test Referral System

1. Login as first user and get invite codes
2. Use invite code when creating second user:
   ```bash
   curl -X POST http://localhost:8080/auth/wallet \
     -H "Content-Type: application/json" \
     -d '{
       "wallet_address": "SecondWalletAddress",
       "invite_code": "ABC123"
     }'
   ```
3. Check referrals for first user to see the relationship

## Database Schema

The application uses 8 main tables:

- **users**: User accounts with wallet addresses
- **invite_codes**: Referral invite codes
- **referrals**: Referral relationships
- **markets**: Prediction markets
- **market_events**: Events within markets
- **orders**: User betting orders
- **transactions**: Virtual currency transactions
- **user_proposals**: User-submitted market proposals

## Project Structure

```
prediction-market/
├── cmd/
│   └── main.go                 # Application entry point
├── internal/
│   ├── models/                 # Database models
│   ├── handlers/               # HTTP handlers
│   ├── services/               # Business logic
│   ├── database/               # Database connection
│   ├── auth/                   # Authentication utilities
│   └── config/                 # Configuration management
├── migrations/                 # SQL migrations
├── scripts/                    # Utility scripts
│   └── migrate.go             # Database migration runner
├── .env.example                # Environment variables template
├── .gitignore
├── go.mod
└── README.md
```

## Development

### Adding New Endpoints

1. Create handler in `internal/handlers/`
2. Create service logic in `internal/services/`
3. Register route in `cmd/main.go`

### Database Migrations

GORM auto-migration runs on startup. For manual migrations:

```bash
# Run specific migration
psql -U postgres -d prediction_market -f migrations/010_remove_twitter_oauth.sql

# Or use the Go migration script
go run scripts/migrate.go
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `pg_isready`
- Check credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### Wallet Authentication Issues

- Ensure wallet address is valid Solana base58 format (32-44 characters)
- Check JWT_SECRET is set in `.env`
- Verify frontend is sending correct wallet address

### Port Already in Use

Change `SERVER_PORT` in `.env` to a different port.

## Deployment

### Railway Deployment

1. Create new Railway project
2. Add PostgreSQL database
3. Set environment variables:
   - `DATABASE_URL` (auto-set by Railway)
   - `JWT_SECRET`
   - `FRONTEND_URL`
   - `SOLANA_RPC_URL`
4. Deploy from GitHub repository

Railway will automatically:
- Detect Go application
- Run `go build`
- Start the server

## Next Steps

This completes the authentication refactoring. Next steps:

- **Frontend Integration**: Connect React app with wallet authentication
- **Market Management**: Implement market creation and trading
- **Real Token Integration**: Move from virtual to real Solana tokens
- **Admin Panel**: Complete admin dashboard
- **Production Launch**: Deploy to mainnet

## License

MIT License
