import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

interface Contest {
  id: number;
  name: string;
  description: string;
  status: string;
  prize_pool: string;
  start_date: string;
  end_date: string;
  rules: string;
}

export default function AdminContests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    prize_pool: '',
    rules: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchContests();
  }, []);

  const fetchContests = async () => {
    try {
      const response = await apiService.getAdminContests();
      setContests(response);
    } catch (error) {
      console.error('Failed to fetch contests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createAdminContest(formData);
      alert('Contest created successfully!');
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        prize_pool: '',
        rules: '',
      });
      setShowForm(false);
      fetchContests();
    } catch (error) {
      console.error('Failed to create contest:', error);
      alert('Failed to create contest');
    }
  };

  const handleStartContest = async (contestId: number) => {
    if (!confirm('Are you sure you want to start this contest?')) return;
    try {
      await apiService.startAdminContest(contestId);
      alert('Contest started!');
      fetchContests();
    } catch (error) {
      console.error('Failed to start contest:', error);
      alert('Failed to start contest');
    }
  };

  const handleEndContest = async (contestId: number) => {
    if (!confirm('Are you sure you want to end this contest and distribute prizes?')) return;
    try {
      await apiService.endAdminContest(contestId);
      alert('Contest ended and prizes distributed!');
      fetchContests();
    } catch (error) {
      console.error('Failed to end contest:', error);
      alert('Failed to end contest');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-600';
      case 'ENDED':
      case 'DISTRIBUTED':
        return 'bg-gray-600';
      case 'PENDING':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
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
          <h1 className="text-3xl font-bold">Contests</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-accent hover:bg-green-500 text-primary font-bold py-2 px-4 rounded-lg"
        >
          {showForm ? 'Cancel' : 'Create Contest'}
        </button>
      </div>

      {/* Create Contest Form */}
      {showForm && (
        <form onSubmit={handleCreateContest} className="bg-secondary rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-bold mb-4">Create New Contest</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Prize Pool *</label>
              <input
                type="number"
                step="0.01"
                value={formData.prize_pool}
                onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
                className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">End Date *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Rules</label>
            <textarea
              value={formData.rules}
              onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
              rows={3}
              className="w-full bg-primary border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-accent hover:bg-green-500 text-primary font-bold py-3 px-4 rounded-lg"
          >
            Create Contest
          </button>
        </form>
      )}

      {/* Contests List */}
      <div className="space-y-4">
        {contests.length === 0 ? (
          <div className="bg-secondary rounded-lg p-8 border border-gray-700 text-center">
            <p className="text-gray-400">No contests yet. Create your first contest!</p>
          </div>
        ) : (
          contests.map((contest) => (
            <div key={contest.id} className="bg-secondary rounded-lg p-6 border border-gray-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{contest.name}</h3>
                  <p className="text-gray-400 mt-1">{contest.description}</p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-400">
                    <span>Prize: ${parseFloat(contest.prize_pool).toLocaleString()}</span>
                    <span>Start: {new Date(contest.start_date).toLocaleDateString()}</span>
                    <span>End: {new Date(contest.end_date).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${getStatusColor(contest.status)}`}>
                  {contest.status}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {contest.status === 'PENDING' && (
                  <button
                    onClick={() => handleStartContest(contest.id)}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold"
                  >
                    Start Contest
                  </button>
                )}
                {contest.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleEndContest(contest.id)}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold"
                  >
                    End & Distribute
                  </button>
                )}
                <button
                  onClick={() => navigate(`/admin/contests/${contest.id}/leaderboard`)}
                  className="bg-accent hover:bg-green-500 text-primary px-4 py-2 rounded-lg font-semibold"
                >
                  View Leaderboard
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
