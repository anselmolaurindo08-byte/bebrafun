import { useEffect, useState } from 'react';
import apiService from '../services/api';
import type { Proposal } from '../types/types';

export default function AdminMarketsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProposals();
    }, []);

    const fetchProposals = async () => {
        setLoading(true);
        try {
            const response = await apiService.getPendingProposals();
            setProposals(response);
        } catch (error) {
            console.error('Failed to fetch proposals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (proposalId: number) => {
        try {
            await apiService.moderateProposal(proposalId, 'approve');
            setProposals(proposals.filter((p) => p.id !== proposalId));
            alert('Proposal approved!');
        } catch (error) {
            console.error('Failed to approve proposal:', error);
        }
    };

    const handleReject = async (proposalId: number) => {
        try {
            await apiService.moderateProposal(proposalId, 'reject');
            setProposals(proposals.filter((p) => p.id !== proposalId));
            alert('Proposal rejected!');
        } catch (error) {
            console.error('Failed to reject proposal:', error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Market Moderation</h1>

            {loading ? (
                <div className="text-center">Loading proposals...</div>
            ) : proposals.length === 0 ? (
                <div className="text-center text-gray-400">No pending proposals</div>
            ) : (
                <div className="space-y-4">
                    {proposals.map((proposal) => (
                        <div
                            key={proposal.id}
                            className="bg-secondary rounded-lg p-4 border border-gray-700"
                        >
                            <div className="mb-4">
                                <h3 className="text-lg font-bold">{proposal.market_title}</h3>
                                <p className="text-gray-400 text-sm">{proposal.market_description}</p>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">
                                    Category: <span className="text-accent">{proposal.category}</span>
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApprove(proposal.id)}
                                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(proposal.id)}
                                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
