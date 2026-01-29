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
        <div className="max-w-6xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-mono font-bold text-pump-white mb-8">Market Moderation</h1>

            {loading ? (
                <div className="text-center py-16">
                    <div className="w-12 h-12 border-4 border-pump-gray-dark border-t-pump-green rounded-full animate-spin-glow mx-auto mb-4"></div>
                    <div className="text-pump-gray-light font-sans">Loading proposals...</div>
                </div>
            ) : proposals.length === 0 ? (
                <div className="text-center py-16 bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg">
                    <div className="text-pump-gray font-sans">No pending proposals</div>
                </div>
            ) : (
                <div className="space-y-4">
                    {proposals.map((proposal) => (
                        <div
                            key={proposal.id}
                            className="bg-pump-gray-darker border-2 border-pump-gray-dark rounded-lg p-5 hover:border-pump-green transition-all duration-200"
                        >
                            <div className="mb-4">
                                <h3 className="text-lg font-mono font-bold text-pump-white">{proposal.market_title}</h3>
                                <p className="text-pump-gray-light font-sans text-sm mt-1">{proposal.market_description}</p>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-pump-gray font-sans">
                                    Category: <span className="text-pump-green font-mono">{proposal.category}</span>
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApprove(proposal.id)}
                                        className="bg-pump-green hover:bg-pump-lime text-pump-black font-sans font-semibold px-4 py-2 rounded-md transition-all duration-200 hover:scale-105"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(proposal.id)}
                                        className="bg-pump-red hover:bg-[#FF5252] text-pump-white font-sans font-semibold px-4 py-2 rounded-md transition-all duration-200 hover:scale-105"
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
