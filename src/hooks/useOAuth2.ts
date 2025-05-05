import { useCallback, useRef } from 'react';
import { getOAuthLogoutUrl } from '../constants/';
import Cookies from 'js-cookie';

type MessageEvent = {
    data: 'logout_complete' | 'logout_error';
    origin: string;
};

const LOGOUT_TIMEOUT = 10000;

/**
 * Custom hook to handle OAuth2 logout and redirection.
 *
 * @param {OAuth2Config} config - Configuration object containing OAuth2 enabled apps flag and initialisation flag.
 * @param {(oauthUrl: string) => Promise<void>} WSLogoutAndRedirect - Function to handle logout and redirection.
 * @returns {{ OAuth2Logout: () => Promise<void> }} - Object containing the OAuth2Logout function.
 * @deprecated Please use OAuth2Logout function instead of this hook from the `@deriv-com/auth-client` package.
 */
export const useOAuth2 = (WSLogoutAndRedirect: () => Promise<void>) => {
    const timeout = useRef<ReturnType<typeof setTimeout>>();

    const cleanup = () => {
        clearTimeout(timeout.current);

        const iframe = document.getElementById('logout-iframe') as HTMLIFrameElement;
        if (iframe) iframe.remove();
    };

    const OAuth2Logout = useCallback(async () => {
        const onMessage = (event: MessageEvent) => {
            if (event.data === 'logout_complete') {
                const domains = ['deriv.com', 'deriv.dev', 'binary.sx', 'pages.dev', 'localhost', 'deriv.be', 'deriv.me'];
                const currentDomain = window.location.hostname.split('.').slice(-2).join('.');
                if (domains.includes(currentDomain)) {
                    Cookies.set('logged_state', 'false', {
                        expires: 30,
                        path: '/',
                        domain: currentDomain,
                        secure: true,
                    });
                }
                WSLogoutAndRedirect();
                window.removeEventListener('message', onMessage);
                cleanup();
            }
        };
        window.addEventListener('message', onMessage);

        let iframe: HTMLIFrameElement | null = document.getElementById('logout-iframe') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'logout-iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            timeout.current = setTimeout(() => {
                WSLogoutAndRedirect();
                window.removeEventListener('message', onMessage);
                cleanup();
            }, LOGOUT_TIMEOUT);
        }

        iframe.src = getOAuthLogoutUrl();

        iframe.onerror = error => {
            console.error('There has been a problem with the logout: ', error);
            window.removeEventListener('message', onMessage);
            cleanup();
        };
    }, [WSLogoutAndRedirect]);

    return { OAuth2Logout };
};
