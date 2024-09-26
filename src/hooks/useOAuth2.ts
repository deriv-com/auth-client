import { useEffect, useCallback, useRef } from 'react';
import { getOAuthLogoutUrl, getOAuthOrigin } from '../constants/';
import { useIsOAuth2Enabled } from './useIsOAuth2Enabled';

type MessageEvent = {
    data: 'logout_complete' | 'logout_error';
    origin: string;
};

export type TOAuth2EnabledAppList = {
    enabled_for: number[];
}[];

type OAuth2GBConfig = {
    OAuth2EnabledApps: TOAuth2EnabledAppList;
    OAuth2EnabledAppsInitialised: boolean;
};

/**
 * Custom hook to handle OAuth2 logout and redirection.
 *
 * @param {OAuth2Config} config - Configuration object containing OAuth2 enabled apps flag and initialisation flag.
 * @param {(oauthUrl: string) => Promise<void>} WSLogoutAndRedirect - Function to handle logout and redirection.
 * @returns {{ OAuth2Logout: () => Promise<void> }} - Object containing the OAuth2Logout function.
 */
export const useOAuth2 = (OAuth2GrowthBookConfig: OAuth2GBConfig, WSLogoutAndRedirect: () => Promise<void>) => {
    const { OAuth2EnabledApps, OAuth2EnabledAppsInitialised } = OAuth2GrowthBookConfig;
    const isOAuth2Enabled = useIsOAuth2Enabled(OAuth2EnabledApps, OAuth2EnabledAppsInitialised);

    const intervalRef = useRef()

    useEffect(() => {
        if (!isOAuth2Enabled) return;

        const onMessage = async (event: MessageEvent) => {
            const allowedOrigin = getOAuthOrigin();
            if (allowedOrigin === event.origin) {
                if (event.data === 'logout_complete') {
                    console.warn("logout completed")
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                    }
                    await WSLogoutAndRedirect();
                } else {
                    console.warn('Unexpected message received: ', event.data);
                }
            } else {
                console.warn('Unexpected postmessage origin: ', event.origin);
            }
        };

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [isOAuth2Enabled, WSLogoutAndRedirect]);

    const OAuth2Logout = useCallback(async () => {
        if (!isOAuth2Enabled) {
            await WSLogoutAndRedirect();
            return;
        }

        let iframe: HTMLIFrameElement | null = document.getElementById('logout-iframe') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'logout-iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            intervalRef.current = setInterval(async () => {
                await WSLogoutAndRedirect();
            }, 10000);
        }

        iframe.src = getOAuthLogoutUrl();

        iframe.onerror = error => {
            console.error('There has been a problem with the logout: ', error);
        };
    }, [isOAuth2Enabled, WSLogoutAndRedirect]);

    return { OAuth2Logout };
};
