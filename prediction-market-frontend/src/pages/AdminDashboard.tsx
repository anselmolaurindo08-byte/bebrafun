import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

interface DashboardData {
  total_users: number;
  total_markets: number;
  total_trades: number;
  active_contests: number;
  stats: {
    total_volume: string;
    active_users: number;
  };
  recent_logs: Array<{
    id: number;
    action: string;
    resource_type: string;
    created_at: string;
    admin?: {
      user?: {
        x_username: string;
      };
    };
  }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await apiService.getAdminDashboard();
      setData(response);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have admin access');
      } else {
        setError('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-accent hover:bg-green-500 text-primary px-6 py-2 rounded-lg font-semibold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-secondary rounded-lg p-6 border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Total Users</p>
          <p className="text-3xl font-bold text-accent">{data?.total_users || 0}</p>
        </div>
        <div className="bg-secondary rounded-lg p-6 border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Total Markets</p>
          <p className="text-3xl font-bold text-accent">{data?.total_markets || 0}</p>
        </div>
        <div className="bg-secondary rounded-lg p-6 border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Total Trades</p>
          <p className="text-3xl font-bold text-accent">{data?.total_trades || 0}</p>
        </div>
        <div className="bg-secondary rounded-lg p-6 border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Active Contests</p>
          <p className="text-3xl font-bold text-accent">{data?.active_contests || 0}</p>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => navigate('/admin/contests')}
          className="bg-secondary hover:bg-gray-600 rounded-lg p-6 border border-gray-700 transition-colors text-left"
        >
          <p className="text-2xl mb-2">🏆</p>
          <p className="text-lg font-bold">Contests</p>
          <p className="text-sm text-gray-400 mt-2">Manage contests and prizes</p>
        </button>
        <button
          onClick={() => navigate('/admin/users')}
          className="bg-secondary hover:bg-gray-600 rounded-lg p-6 border border-gray-700 transition-colors text-left"
        >
          <p className="text-2xl mb-2">👥</p>
          <p className="text-lg font-bold">Users</p>
          <p className="text-sm text-gray-400 mt-2">Manage users and restrictions</p>
        </button>
        <button
          onClick={() => navigate('/admin/markets')}
          className="bg-secondary hover:bg-gray-600 rounded-lg p-6 border border-gray-700 transition-colors text-left"
        >
          <p className="text-2xl mb-2">📊</p>
          <p className="text-lg font-bold">Markets</p>
          <p className="text-sm text-gray-400 mt-2">Manage markets and proposals</p>
        </button>
        <button
          onClick={() => navigate('/admin/logs')}
          className="bg-secondary hover:bg-gray-600 rounded-lg p-6 border border-gray-700 transition-colors text-left"
        >
          <p className="text-2xl mb-2">📝</p>
          <p className="text-lg font-bold">Logs</p>
          <p className="text-sm text-gray-400 mt-2">View admin activity logs</p>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="bg-secondary rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Recent Admin Activity</h2>
        </div>
        <div className="p-4">
          {data?.recent_logs && data.recent_logs.length > 0 ? (
            <div className="space-y-3">
              {data.recent_logs.map((log) => (
                <div key={log.id} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                  <div>
                    <span className="font-semibold text-accent">{log.action}</span>
                    {log.resource_type && (
                      <span className="text-gray-400 ml-2">on {log.resource_type}</span>
                    )}
                    {log.admin?.user && (
                      <span className="text-gray-500 ml-2">by @{log.admin.user.x_username}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
