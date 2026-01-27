# Deployment Planning Questionnaire

## Server Information Needed

Please provide the following information about your server:

### 1. Operating System
- [ ] Linux Ubuntu
- [ ] Linux Debian
- [ ] Linux CentOS/RHEL
- [ ] Windows Server
- [ ] Other: ___________

### 2. Server Access
- **IP Address or Domain:** ___________
- **SSH Port:** ___________
- **SSH Username:** ___________
- **Do you have sudo/root access?** Yes / No

### 3. Installed Software
- [ ] Go (version: _______)
- [ ] PostgreSQL (version: _______)
- [ ] Nginx
- [ ] Apache
- [ ] Docker
- [ ] None of the above

### 4. Domain Configuration
- **Do you have a domain?** Yes / No
- **Domain name:** ___________
- **Is DNS already configured?** Yes / No

### 5. SSL/HTTPS
- **Do you need HTTPS?** Yes (recommended) / No
- **Do you have SSL certificate?** Yes / No / Need Let's Encrypt

## What I Will Prepare

Based on your answers, I will create:

### For Linux Server:
1. **Deployment Script** - Automated deployment
2. **Systemd Service** - Auto-start on boot
3. **Nginx Configuration** - Reverse proxy
4. **SSL Setup** - Let's Encrypt (if needed)
5. **PostgreSQL Setup** - Database configuration
6. **Environment Configuration** - Production .env

### For Windows Server:
1. **Deployment Script** - PowerShell automation
2. **Windows Service** - Auto-start configuration
3. **IIS Configuration** - Reverse proxy
4. **SSL Setup** - Certificate configuration
5. **PostgreSQL Setup** - Database configuration

## Quick Deploy Options

### Option 1: Full Server Setup (Recommended)
- Complete production deployment
- Nginx + SSL + PostgreSQL
- Systemd service for auto-restart
- Domain with HTTPS

### Option 2: Docker Deployment (Easiest)
- Everything in containers
- Easy to manage and update
- Includes PostgreSQL in container
- Quick setup

### Option 3: Simple Deploy (Testing)
- Just run the Go app
- No reverse proxy
- HTTP only
- Manual start

## Example Deployment Architecture

```
Internet
    ↓
Domain (yourdomain.com)
    ↓
Nginx (Port 80/443) + SSL
    ↓
Go App (Port 8080)
    ↓
PostgreSQL (Port 5432)
```

## Twitter OAuth Configuration

After deployment, you'll update Twitter Developer Portal:
- **Callback URL:** `https://yourdomain.com/auth/callback`
- **Website URL:** `https://yourdomain.com`

This will work perfectly with Twitter OAuth!
