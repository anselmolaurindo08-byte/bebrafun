import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
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
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { loadFromStorage, isAuthenticated } = useUserStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Simple test to see if React is rendering
  console.log('App component rendering', { isAuthenticated });

  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/markets/:id" element={<MarketDetailPage />} />
        <Route
          path="/markets/propose"
          element={
            <ProtectedRoute>
              <ProposeMarketPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/contests"
          element={
            <ProtectedRoute>
              <AdminContests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/markets"
          element={
            <ProtectedRoute>
              <AdminMarketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrals"
          element={
            <ProtectedRoute>
              <ReferralPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/duels/wallet"
          element={
            <ProtectedRoute>
              <DuelsWalletPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/duels"
          element={
            <ProtectedRoute>
              <DuelsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/duels/create"
          element={
            <ProtectedRoute>
              <CreateDuelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/duels/:id"
          element={
            <ProtectedRoute>
              <ActiveDuelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
          }
        />
        <Route path="/oauth-callback" element={<AuthCallbackPage />} />
      </Routes>
    </Router>
  );
}

export default App;
