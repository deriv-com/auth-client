import { useCallback, useState, useEffect } from 'react';
import { LegacyTokens, requestLegacyToken, requestOidcToken, OIDCError, OIDCErrorType } from '../../oidc';
import DerivLogoIcon from '../../assets/deriv_logo.svg?react';
import DerivLoaderIcon from '../../assets/callback_loader.gif';
import Cookies from 'js-cookie';

import './Callback.scss';

type CallbackProps = {
    /** callback function triggerred when `requestOidcToken` is successful. Use this only when you want to request the legacy tokens yourself, otherwise pass your callback to `onSignInSuccess` prop instead */
    onRequestOidcTokenSuccess?: (accessToken: string, state: unknown) => void;
    /** callback function triggered when the OIDC authentication flow is successful */
    onSignInSuccess?: (tokens: LegacyTokens, state: unknown) => void;
    /** callback function triggered when sign-in encounters an error */
    onSignInError?: (error: Error) => void;
    /** URI to redirect to the callback page. This is where you should pass the callback page URL in your app .e.g. https://app.deriv.com/callback or https://smarttrader.deriv.com/en/callback  */
    redirectCallbackUri?: string;
    /** URI to redirect after authentication is completed or failed. Defaults to `config.post_login_redirect_uri` in local storage, and `window.location.origin` if local storage is not set */
    postLoginRedirectUri?: string;
    /** URI to redirect after logout. Defaults to `config.post_logout_redirect_uri` in local storage, and `window.location.origin` if local storage is not set */
    postLogoutRedirectUri?: string;
    /** callback function triggered when return button is clicked in error state */
    onClickReturn?: (error: OIDCError) => void;
    /** renders the custom button for the return button when the error page is shown */
    renderReturnButton?: () => React.ReactNode;
};

/**
 * Callback component handles the OAuth callback process and token management
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} [props.onSignInSuccess] - Callback for successful sign-in
 * @param {Function} [props.onSignInError] - Callback for sign-in errors
 * @param {string} props.callbackRedirectUri - The URI for the callback page
 * @param {string} [props.postLogoutRedirectUri] - Post-logout redirect URI
 * @param {Function} [props.onClickReturn] - Callback for return button click
 * @param {string} [props.errorMessage] - Custom error message
 *
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * ```jsx
 * <Callback
 *   callbackRedirectUri="https://app.deriv.com/callback"
 *   onSignInSuccess={(tokens) => handleSuccess(tokens)}
 *   onSignInError={(error) => handleError(error)}
 * />
 **/

export const Callback = ({
    onClickReturn: onClickReturnCallback,
    onSignInSuccess,
    onSignInError,
    onRequestOidcTokenSuccess,
    redirectCallbackUri,
    postLoginRedirectUri,
    postLogoutRedirectUri,
    renderReturnButton,
}: CallbackProps) => {
    const [error, setError] = useState<Error | null>(null);

    const fetchTokens = useCallback(async () => {
        try {
            const { accessToken, user } = await requestOidcToken({
                redirectCallbackUri,
                postLogoutRedirectUri,
            });

            if (accessToken) {
                onRequestOidcTokenSuccess?.(accessToken, user?.state);

                const legacyTokens = await requestLegacyToken(accessToken);

                onSignInSuccess?.(legacyTokens, user?.state);
                const domains = ['deriv.com', 'deriv.dev', 'binary.sx', 'pages.dev', 'localhost'];
                const currentDomain = window.location.hostname.split('.').slice(-2).join('.');
                if (domains.includes(currentDomain)) {
                    Cookies.set('logged_state', 'true', {
                        expires: 30,
                        path: '/',
                        domain: currentDomain,
                        secure: true,
                    });
                }
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err);
                onSignInError?.(err);
            }
        }
    }, [redirectCallbackUri, postLogoutRedirectUri]);

    const onClickReturn = () => {
        if (onClickReturnCallback && error !== null) {
            onClickReturnCallback(error);
        } else {
            // Redirect the user back to the page they started from
            // If there's no record from where they came from, default to redirect back to their main home page (window.location.origin)
            // window.location.origin returns => https://app.deriv.com if the URL is https://app.deriv.com/callback
            const _postLoginRedirectUri =
                postLoginRedirectUri ||
                localStorage.getItem('config.post_login_redirect_uri') ||
                window.location.origin;
            window.location.href = _postLoginRedirectUri;
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oneTimeCode = params.get('code');

        if (oneTimeCode) {
            fetchTokens();
        } else {
            setError(
                new OIDCError(
                    OIDCErrorType.OneTimeCodeMissing,
                    'the one time code was not returned by the authorization server'
                )
            );
        }
    }, []);

    return (
        <div className='callback'>
            <div className='callback__content'>
                {!error && (
                    <>
                        <img src={DerivLoaderIcon} width={234} height={234} />
                    </>
                )}
                {error && (
                    <>
                        <DerivLogoIcon width={92} height={92} />
                        <h3 className='callback__title'>Unexpected error occured</h3>
                        {!renderReturnButton && (
                            <button className='callback__button' onClick={onClickReturn}>
                                Try again
                            </button>
                        )}
                        {renderReturnButton?.()}
                    </>
                )}
            </div>
        </div>
    );
};
