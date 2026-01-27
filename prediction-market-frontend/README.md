# Prediction Market Frontend

React frontend for the Prediction Market application with TypeScript and TailwindCSS.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Zustand** - State management
- **Axios** - HTTP client

## Prerequisites

- Node.js 18+ and npm
- Backend server running on http://localhost:8080

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will run on http://localhost:3000

## Project Structure

```
src/
├── components/         # Reusable components
│   ├── Header.tsx
│   └── ProtectedRoute.tsx
├── pages/             # Page components
│   ├── LoginPage.tsx
│   ├── ProfilePage.tsx
│   └── HomePage.tsx
├── services/          # API services
│   └── api.ts
├── store/             # Zustand stores
│   └── userStore.ts
├── types/             # TypeScript types
│   └── index.ts
├── App.tsx            # Main app component
├── main.tsx           # Entry point
└── index.css          # Global styles
```

## Features

### ✅ Authentication
- X.com OAuth login flow
- JWT token management
- Protected routes
- Persistent sessions

### ✅ User Interface
- Responsive design
- Dark theme
- User profile page
- Balance display
- Header with dropdown menu

### ✅ State Management
- Zustand for global state
- LocalStorage persistence
- Type-safe API calls

## Environment Variables

Create `.env.local`:

```env
VITE_API_URL=http://localhost:8080
VITE_APP_NAME=Prediction Market
```

## API Integration

The frontend connects to the Go backend API:

- `GET /auth/login` - OAuth login
- `GET /auth/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /api/user/profile` - User profile
- `GET /api/user/balance` - Virtual balance
- `GET /health` - Health check

## Routes

- `/` - Redirects to /home or /login
- `/login` - Login page (public)
- `/home` - Home page (protected)
- `/profile` - User profile (protected)

## Development

### Running Both Servers

Terminal 1 (Backend):
```bash
cd prediction-market
go run cmd/main.go
```

Terminal 2 (Frontend):
```bash
cd prediction-market-frontend
npm run dev
```

### Testing

1. Open http://localhost:3000
2. Click "Sign in with X.com"
3. Authorize with Twitter
4. View your profile

## Styling

Custom TailwindCSS theme:

```javascript
colors: {
  primary: '#1a1a1a',    // Dark background
  secondary: '#2d2d2d',  // Card background
  accent: '#00d084',     // Green accent
  danger: '#ff6b6b',     // Red for errors
}
```

## Next Steps

- Step 1.3: Add markets list
- Step 1.4: Implement betting logic
- Step 1.5: Social features

## Troubleshooting

### Backend not responding
Make sure the Go server is running on port 8080

### OAuth not working
Twitter OAuth requires a public URL. Use ngrok or deploy to a server.

### Port 3000 already in use
Change port in `vite.config.ts`

## License

MIT
