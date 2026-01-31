import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import { SolanaWalletProvider } from './contexts/WalletProvider';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import HomePage from './pages/HomePage';
import MarketsPage from './pages/MarketsPage';
import MarketDetailPage from './pages/MarketDetailPage';
import ProposeMarketPage from './pages/ProposeMarketPage';
import AdminMarketsPage from './pages/AdminMarketsPage';
import ReferralPage from './pages/ReferralPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminContests from './pages/AdminContests';
import AdminUsers from './pages/AdminUsers';
import DuelsWalletPage from './pages/DuelsWalletPage';
import { DuelsPage } from './pages/duels/DuelsPage';
import { CreateDuelPage } from './pages/duels/CreateDuelPage';
import { ActiveDuelPage } from './pages/duels/ActiveDuelPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { loadFromStorage, isAuthenticated } = useUserStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  console.log('App component rendering', { isAuthenticated });

  return (
    <SolanaWalletProvider>
      <Router>
        <Header />
        <Routes>
          {/* Public Routes - No authentication required */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/markets/:id" element={<MarketDetailPage />} />
          <Route path="/duels" element={<DuelsPage />} />
          <Route path="/duels/:id" element={<ActiveDuelPage />} />


          {/* Protected Routes - Require authentication */}
          <Route
            path="/markets/propose"
            element={
              <ProtectedRoute requireAuth={true}>
                <ProposeMarketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/duels/create"
            element={
              <ProtectedRoute requireAuth={true}>
                <CreateDuelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/duels/wallet"
            element={
              <ProtectedRoute requireAuth={true}>
                <DuelsWalletPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requireAuth={true}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/home"
            element={
              <ProtectedRoute requireAuth={true}>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/referrals"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReferralPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes - Require authentication */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/contests"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminContests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/markets"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminMarketsPage />
              </ProtectedRoute>
            }
          />

          {/* Root Route */}
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/markets" replace />
            }
          />
        </Routes>
      </Router>
    </SolanaWalletProvider>
  );
}

export default App;
