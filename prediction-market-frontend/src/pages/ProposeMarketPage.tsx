import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

export default function ProposeMarketPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Politics',
    });

    const categories = ['Politics', 'Sports', 'Crypto'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await apiService.proposeMarket(formData);
            alert('Market proposal submitted successfully!');
            navigate('/markets');
        } catch (error) {
            console.error('Failed to propose market:', error);
            alert('Failed to submit proposal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Propose a Market</h1>

            <form onSubmit={handleSubmit} className="bg-secondary rounded-lg p-6 border border-gray-700">
                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">Market Title</label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="e.g., Will Bitcoin reach $100,000 by end of 2024?"
                        required
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Provide more details about the market..."
                        rows={4}
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">Category</label>
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                    >
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent hover:bg-green-500 text-primary font-bold py-3 px-4 rounded-lg disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Submitting...' : 'Submit Proposal'}
                </button>
            </form>
        </div>
    );
}
