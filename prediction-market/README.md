# Prediction Market - Backend

A prediction market platform built with Go, PostgreSQL, and X.com (Twitter) OAuth authentication.

## Features

- **X.com OAuth Authentication**: Login exclusively through Twitter/X.com
- **Referral System**: Multi-level referral system with rebates based on follower count (15%-50%)
- **Virtual Currency**: Season 0 operates with virtual dollars
- **Invite Codes**: Each user receives 5 invite codes upon registration
- **Market Categories**: Politics, Sports, Crypto, Solana

## Tech Stack

- **Backend**: Go (Golang)
- **Database**: PostgreSQL
- **Authentication**: X.com OAuth 2.0 + JWT
- **Web Framework**: Gin
- **ORM**: GORM

## Prerequisites

- Go 1.21 or higher
- PostgreSQL 14 or higher
- Twitter Developer Account (for OAuth credentials)

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

Optionally, run the SQL migration manually:

```bash
psql -U postgres -d prediction_market -f migrations/001_initial_schema.sql
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

# X.com OAuth Configuration
TWITTER_CONSUMER_KEY=your_twitter_consumer_key
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret
TWITTER_CALLBACK_URL=http://localhost:8080/auth/callback

# Server Configuration
SERVER_PORT=8080
JWT_SECRET=your_secret_key_change_this_in_production

# Application Settings
INITIAL_VIRTUAL_BALANCE=1000.00
INVITE_CODES_PER_USER=5
```

### 4. Get Twitter OAuth Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or use an existing one
3. Navigate to "Keys and tokens"
4. Copy your **API Key** (Consumer Key) and **API Secret Key** (Consumer Secret)
5. In "User authentication settings", set:
   - **Callback URL**: `http://localhost:8080/auth/callback`
   - **Website URL**: `http://localhost:8080`
6. Enable "Request email from users" if needed
7. Save your credentials in `.env`

### 5. Run the Application

```bash
go run cmd/main.go
```

The server will start on `http://localhost:8080`

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/auth/login` | Redirect to X.com OAuth |
| GET | `/auth/callback` | OAuth callback handler |
| GET | `/auth/logout` | Logout user |

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
  "time": "2026-01-26T15:42:00Z"
}
```

### 2. Login Flow

1. Open browser and navigate to: `http://localhost:8080/auth/login`
2. You'll be redirected to X.com for authorization
3. After authorization, you'll be redirected back with a JWT token
4. Save the token for subsequent requests

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
2. Use one of the invite codes: `http://localhost:8080/auth/login?invite_code=<code>`
3. Login as second user
4. Check referrals for first user to see the relationship

## Database Schema

The application uses 8 main tables:

- **users**: User accounts with X.com data
- **invite_codes**: Referral invite codes
- **referrals**: Referral relationships
- **markets**: Prediction markets
- **market_events**: Events within markets
- **orders**: User betting orders
- **transactions**: Virtual currency transactions
- **user_proposals**: User-submitted market proposals

## Referral Rebate Tiers

Rebate percentage is calculated based on X.com follower count:

| Followers | Rebate % |
|-----------|----------|
| 100,000+ | 50% |
| 50,000+ | 40% |
| 25,000+ | 30% |
| 10,000+ | 25% |
| 5,000+ | 20% |
| 1,000+ | 15% |
| < 1,000 | 10% |

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
psql -U postgres -d prediction_market -f migrations/001_initial_schema.sql
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `pg_isready`
- Check credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### OAuth Issues

- Verify Twitter OAuth credentials are correct
- Check callback URL matches Twitter app settings
- Ensure app has proper permissions in Twitter Developer Portal

### Port Already in Use

Change `SERVER_PORT` in `.env` to a different port.

## Next Steps

This completes **Step 1.1** of the implementation plan. Next steps:

- **Step 1.2**: Frontend basics (React + TypeScript + TailwindCSS)
- **Step 1.3**: Market parsing and management
- **Step 1.4**: Core Prediction Market logic
- **Step 1.5**: Viral and social mechanics
- **Step 1.6**: Admin panel and launch

## License

MIT License
