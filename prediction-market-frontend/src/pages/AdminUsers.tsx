import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

interface User {
  id: number;
  x_username: string;
  x_id: string;
  followers_count: number;
  virtual_balance: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [restrictForm, setRestrictForm] = useState({
    restriction_type: 'SUSPEND',
    reason: '',
    duration_days: 7,
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    try {
      const response = await apiService.getAdminUsers(50, 0, search);
      setUsers(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await apiService.restrictUser({
        user_id: selectedUser.id,
        ...restrictForm,
      });
      alert('User restricted successfully');
      setShowRestrictModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to restrict user:', error);
      alert('Failed to restrict user');
    }
  };

  const handleUpdateBalance = async (userId: number) => {
    const amount = prompt('Enter amount (positive to add, negative to subtract):');
    if (!amount) return;

    const reason = prompt('Enter reason for balance change:');
    if (!reason) return;

    try {
      await apiService.updateUserBalance({
        user_id: userId,
        amount: amount,
        reason: reason,
      });
      alert('Balance updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Failed to update balance:', error);
      alert('Failed to update balance');
    }
  };

  const handlePromoteToAdmin = async (userId: number) => {
    const role = prompt('Enter role (SUPER_ADMIN, MODERATOR, or ANALYST):');
    if (!role || !['SUPER_ADMIN', 'MODERATOR', 'ANALYST'].includes(role)) {
      alert('Invalid role');
      return;
    }

    try {
      await apiService.promoteToAdmin({
        user_id: userId,
        role: role,
      });
      alert('User promoted to admin');
    } catch (error) {
      console.error('Failed to promote user:', error);
      alert('Failed to promote user');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold">Users</h1>
          <span className="text-gray-400">({total} total)</span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-96 bg-secondary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      {/* Users Table */}
      <div className="bg-secondary rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-primary">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Followers</th>
              <th className="px-4 py-3 text-left">Balance</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3">{user.id}</td>
                <td className="px-4 py-3">
                  <span className="text-accent">@{user.x_username}</span>
                </td>
                <td className="px-4 py-3">{user.followers_count.toLocaleString()}</td>
                <td className="px-4 py-3">${parseFloat(user.virtual_balance).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateBalance(user.id)}
                      className="text-sm bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                    >
                      Balance
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowRestrictModal(true);
                      }}
                      className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                    >
                      Restrict
                    </button>
                    <button
                      onClick={() => handlePromoteToAdmin(user.id)}
                      className="text-sm bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
                    >
                      Promote
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Restrict Modal */}
      {showRestrictModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Restrict @{selectedUser.x_username}</h2>
            <form onSubmit={handleRestrict}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Restriction Type</label>
                <select
                  value={restrictForm.restriction_type}
                  onChange={(e) => setRestrictForm({ ...restrictForm, restriction_type: e.target.value })}
                  className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2"
                >
                  <option value="SUSPEND">Suspend</option>
                  <option value="BAN">Ban</option>
                  <option value="TRADING_DISABLED">Disable Trading</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Reason</label>
                <textarea
                  value={restrictForm.reason}
                  onChange={(e) => setRestrictForm({ ...restrictForm, reason: e.target.value })}
                  className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2"
                  rows={3}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Duration (days, 0 for permanent)</label>
                <input
                  type="number"
                  value={restrictForm.duration_days}
                  onChange={(e) => setRestrictForm({ ...restrictForm, duration_days: parseInt(e.target.value) })}
                  className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2"
                  min="0"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestrictModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold"
                >
                  Restrict User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
