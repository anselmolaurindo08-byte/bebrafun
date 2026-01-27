# Quick Setup Guide

## Prerequisites Check

Before running the application, ensure you have:

1. ✅ **Go 1.21+** installed
   ```bash
   go version
   ```

2. ✅ **PostgreSQL** installed and running
   ```bash
   # Windows (check if service is running)
   Get-Service postgresql*
   
   # Or check if you can connect
   psql -U postgres -c "SELECT version();"
   ```

3. ✅ **Twitter Developer Account** with OAuth credentials

## Step-by-Step Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE prediction_market;

# Exit
\q
```

### 2. Configure Environment Variables

Edit the `.env` file and update:

```env
# Update your PostgreSQL password if different
DB_PASSWORD=your_postgres_password

# Add your Twitter OAuth credentials
TWITTER_CONSUMER_KEY=your_actual_key
TWITTER_CONSUMER_SECRET=your_actual_secret
```

### 3. Get Twitter OAuth Credentials

1. Visit: https://developer.twitter.com/en/portal/dashboard
2. Create a new app (or use existing)
3. Go to "Keys and tokens" tab
4. Copy **API Key** → use as `TWITTER_CONSUMER_KEY`
5. Copy **API Secret Key** → use as `TWITTER_CONSUMER_SECRET`
6. In "User authentication settings":
   - Callback URL: `http://localhost:8080/auth/callback`
   - Website URL: `http://localhost:8080`
   - Enable OAuth 1.0a

### 4. Run the Application

```bash
# From the prediction-market directory
go run cmd/main.go
```

You should see:
```
Server starting on port 8080
Health check: http://localhost:8080/health
Login URL: http://localhost:8080/auth/login
```

### 5. Test the Application

**Health Check:**
```bash
curl http://localhost:8080/health
```

**Login Flow:**
1. Open browser: http://localhost:8080/auth/login
2. Authorize with Twitter/X.com
3. You'll receive a JWT token in the response

**Test Protected Endpoint:**
```bash
# Replace <TOKEN> with your actual JWT token
curl -H "Authorization: Bearer <TOKEN>" http://localhost:8080/api/user/profile
```

## Troubleshooting

### "Failed to connect to database"
- Check PostgreSQL is running
- Verify credentials in `.env`
- Ensure database `prediction_market` exists

### "Twitter OAuth credentials are required"
- Make sure you've updated `.env` with real Twitter credentials
- Don't use the placeholder values

### "Port 8080 already in use"
- Change `SERVER_PORT` in `.env` to a different port (e.g., 8081)

## What's Created

When you first run the app:
- ✅ Database tables auto-created via GORM migrations
- ✅ Server starts on port 8080
- ✅ Ready to accept OAuth logins

When a user logs in:
- ✅ User record created in database
- ✅ 5 invite codes generated automatically
- ✅ Initial virtual balance of $1000 credited
- ✅ JWT token returned for authentication

## Next Steps

After successful setup:
1. Test the referral system (login with invite code)
2. Verify database records are created
3. Move to **Step 1.2**: Frontend development

## Project Structure

```
prediction-market/
├── cmd/
│   └── main.go                 # ← Start here
├── internal/
│   ├── models/                 # Database models
│   ├── handlers/               # API endpoints
│   ├── services/               # Business logic
│   ├── database/               # DB connection
│   ├── auth/                   # JWT & middleware
│   └── config/                 # Configuration
├── migrations/
│   └── 001_initial_schema.sql  # SQL schema
├── .env                        # ← Configure this
├── .env.example
├── go.mod
├── go.sum
└── README.md
```
