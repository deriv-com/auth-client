import { useContext } from 'react';
import { OAuth2Context } from '../context/auth-context.tsx';

export const useOAuth2 = () => {
    const context = useContext(OAuth2Context);
    if (!context) {
        throw new Error('useOAuth2 must be used within an OAuth2Provider');
    }
    return context;
};