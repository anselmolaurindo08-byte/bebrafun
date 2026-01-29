import { Navigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean; // Default: false for browsing pages, true for protected pages
}

export default function ProtectedRoute({ children, requireAuth = false }: ProtectedRouteProps) {
    const { user, token, isLoading } = useUserStore();

    const isAuthenticated = !!token && !!user?.wallet_address;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-pump-black">
                <div className="text-xl text-pump-green font-mono">Loading...</div>
            </div>
        );
    }

    // If route requires authentication and user is not authenticated, redirect to login
    if (requireAuth && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Otherwise, allow access (for public browsing pages or authenticated users)
    return <>{children}</>;
}
