# Fixing Twitter OAuth Error 401

## Problem

Error: `Desktop applications only support the oauth_callback value 'oob'`

This means your Twitter app is configured as a **Desktop Application** instead of a **Web Application**.

## Solution: Update Twitter App Settings

### Step 1: Go to Twitter Developer Portal

1. Visit: https://developer.twitter.com/en/portal/dashboard
2. Find your app in the list
3. Click on the app name

### Step 2: Update App Settings

1. Click on **"Settings"** tab
2. Scroll down to **"User authentication settings"**
3. Click **"Set up"** or **"Edit"** button

### Step 3: Configure OAuth Settings

**App permissions:**
- ✅ Read (minimum required)
- You can also enable Write if needed

**Type of App:**
- ❌ **NOT** "Native App" or "Desktop App"
- ✅ Select **"Web App, Automated App or Bot"**

**App info:**
- **Callback URL / Redirect URL:** `http://localhost:8080/auth/callback`
- **Website URL:** `http://localhost:8080`

**Important:** Make sure to use OAuth 1.0a, not OAuth 2.0

### Step 4: Save Changes

Click **"Save"** button at the bottom

### Step 5: Restart Your Server

After updating Twitter settings:

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then restart:
cd C:\Users\mormeli\.gemini\antigravity\scratch\prediction-market
go run cmd/main.go
```

### Step 6: Test Again

Open browser: http://localhost:8080/auth/login

You should now be redirected to Twitter successfully!

---

## Alternative: If You Can't Change App Type

If you can't change the app type, you'll need to create a **new Twitter app**:

1. Go to: https://developer.twitter.com/en/portal/projects-and-apps
2. Click **"+ Create App"** or **"+ Add App"**
3. Give it a name (e.g., "Prediction Market Dev")
4. Select **"Web App"** as the type
5. Set callback URL: `http://localhost:8080/auth/callback`
6. Get the new **API Key** and **API Secret Key**
7. Update your `.env` file with the new credentials

---

## Quick Reference

**What you need in Twitter Developer Portal:**

```
App Type: Web App, Automated App or Bot
OAuth Version: 1.0a
Callback URL: http://localhost:8080/auth/callback
Website URL: http://localhost:8080
Permissions: Read (minimum)
```

**Your current credentials:**
- Consumer Key: `yoAJbb1yux3TwD1822OEZNdhP`
- Consumer Secret: `ATH9McuiAQk8A6di0YjoqriQHvNmmMi1Gu7IDxNyfmXZKWSrjB`

These will remain the same if you just update settings. Only if you create a new app will you get new credentials.
