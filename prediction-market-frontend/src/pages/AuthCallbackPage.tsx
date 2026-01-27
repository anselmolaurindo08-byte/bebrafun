import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../services/api';

const AuthCallbackPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setToken, setUser } = useUserStore();
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const token = searchParams.get('token');
        if (token) {
            console.log('Token received from callback');
            setToken(token);
            
            // Verify token and get user profile
            api.getProfile()
                .then(user => {
                    console.log('User profile fetched successfully');
                    setUser(user);
                    navigate('/home', { replace: true });
                })
                .catch(err => {
                    console.error('Failed to fetch profile:', err);
                    navigate('/login?error=auth_failed', { replace: true });
                });
        } else {
            console.error('No token found in URL');
            navigate('/login?error=missing_token', { replace: true });
        }
    }, [searchParams, navigate, setToken, setUser]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold">Authenticating...</h2>
            </div>
        </div>
    );
};

export default AuthCallbackPage;
