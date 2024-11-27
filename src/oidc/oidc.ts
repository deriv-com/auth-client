import Cookies from 'js-cookie';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { OIDCError, OIDCErrorType } from './error';
import { getServerInfo } from '../constants';
import { getConfigurations } from './config';

export type OidcConfiguration = {
    issuer: string;
    redirect_uri: string;
    client_id: string;
    response_type: string;
    scope: string;
    post_logout_redirect_uri: string;
};

export type LegacyTokens = {
    acct1: string;
    acct2?: string;
    acct3?: string;
    token1: string;
    token2?: string;
    token3?: string;
    cur1: string;
    cur2?: string;
    cur3?: string;
};

type RequestOidcAuthenticationOptions = {
    redirectCallbackUri?: string;
    postLoginRedirectUri?: string;
    postLogoutRedirectUri?: string;
};

type RequestOidcTokenOptions = {
    redirectCallbackUri?: string;
    postLogoutRedirectUri?: string;
};

type CreateUserManagerOptions = {
    redirectCallbackUri?: string;
    postLogoutRedirectUri?: string;
};

type RequestSilentLoginOptions = {
    clientAccounts: Record<string | number, unknown>;
    redirectCallbackUri: string;
    endpointUri?: string;
};

/**
 * Fetches the OIDC configuration for the given serverUrl.
 * @returns {Promise<object>} - A promise resolving to the OIDC configuration.
 * @throws {Error} - If there is a failure while fetching the OIDC configuration.
 */
export const fetchOidcConfiguration = async (): Promise<OidcConfiguration> => {
    const configFromLocalStorage = localStorage.getItem('config.oidc_endpoints');
    if (configFromLocalStorage) {
        const { serverUrl } = getServerInfo();
        const config = JSON.parse(configFromLocalStorage) as OidcConfiguration;
        // we need to check this, because in case when they go to the endpoints page and switch the app ID and server URL
        // we need to invalidate our OIDC configurations cuz its still pointing to the old server URL
        if (config.issuer === serverUrl) return JSON.parse(configFromLocalStorage);
    }

    const { serverUrl } = getServerInfo();
    const oidc_url = `https://${serverUrl}/.well-known/openid-configuration`;

    try {
        const response = await fetch(oidc_url);
        const data = await response.json();

        localStorage.setItem('config.oidc_endpoints', JSON.stringify(data));

        return data;
    } catch (error) {
        console.error('Failed to fetch OIDC configuration:', error);
        if (error instanceof Error) throw new OIDCError(OIDCErrorType.FailedToFetchOIDCConfiguration, error.message);
        throw new OIDCError(OIDCErrorType.FailedToFetchOIDCConfiguration, 'unable to fetch OIDC configuration');
    }
};

/**
 * Initiates the OIDC authentication flow by redirecting to Deriv's authorization server.
 * This is the first step in the OIDC flow, which calls the authorization endpoint and if successful, should redirect back to the callback page.
 *
 * Your application must have a callback page with the `Callback` component from this library, or if not, some page that calls the next few endpoints using `requestOidcToken` and `requestLegacyToken`
 *
 * @param options - Configuration options for the OIDC authentication request
 * @param options.redirectCallbackUri - The callback page URI to redirect back
 * @param options.postLoginRedirectUri - The URI to redirect after the callback page. This is where you usually pass the page URL where you initiated the login flow
 * @param options.postLogoutRedirectUri - The URI where the application should redirect after processing the logout
 *
 * @returns Promise that resolves to an object containing the UserManager instance
 * @throws {OIDCError} With type AuthenticationRequestFailed if the authentication request fails
 *
 * @example
 * ```typescript
 * try {
 *   const { userManager } = await requestOidcAuthentication({
 *     redirectCallbackUri: 'https://smarttrader.deriv.com/en/callback',
 *     postLoginRedirectUri: 'https://smarttrader.deriv.com/en/trading',
 *     postLogoutRedirectUri: https://smarttrader.deriv.com/en/trading''
 *   });
 * } catch (error) {
 *   // Handle authentication request error
 * }
 * ```
 *
 * @remarks
 * - If postLoginRedirectUri is not provided, it defaults to the current window's URL origin, i.e. https://smarttrader.deriv.com instead of https://smarttrader.deriv.com/en/trading
 * - If postLogoutRedirectUri is not provided, it defaults to the current window's origin,  i.e. https://smarttrader.deriv.com instead of https://smarttrader.deriv.com/en/trading
 * - The post login/logout redirect URIs are stored in local storage as `config.post_login_redirect_uri` and `config.post_logout_redirect_uri`
 */
export const requestOidcAuthentication = async (options: RequestOidcAuthenticationOptions) => {
    const { redirectCallbackUri, postLoginRedirectUri, postLogoutRedirectUri } = options;

    // If the post login redirect URI is not specified, redirect the user back to where the OIDC authentication is initiated
    // This will be used later by the Callback component to redirect back to where the OIDC flow is initiated
    localStorage.setItem('config.post_login_redirect_uri', postLoginRedirectUri || window.location.origin);
    // Same as post login redirect URI, if not specified we default to where this function is called for post logout redirect
    localStorage.setItem('config.post_logout_redirect_uri', postLogoutRedirectUri || window.location.origin);

    try {
        const userManager = await createUserManager({
            redirectCallbackUri,
            postLogoutRedirectUri,
        });

        await userManager.signinRedirect();
        return { userManager };
    } catch (error) {
        console.error('Authentication failed:', error);
        if (error instanceof Error) throw new OIDCError(OIDCErrorType.AuthenticationRequestFailed, error.message);
        throw new OIDCError(OIDCErrorType.AuthenticationRequestFailed, 'unable to request OIDC authentication');
    }
};

/**
 * Requests access tokens from the authorization server.  * The returned access tokens will be used to fetch the original tokens that can be passed to the `authorize` endpoint.
 *
 * This function should only be called when `requestOidcAuthentication` has been called. Generally this function should be placed within the callback page.
 *
 * @param options - Configuration options for the OIDC token request
 * @param options.redirectCallbackUri - The callback page URI to redirect back
 * @param options.postLogoutRedirectUri - The URI to redirect after successfully logging out
 * @returns Promise that resolves to an object containing the access token
 * @returns {Object} result
 * @returns {string} result.accessToken - The OAuth2/OIDC access token
 *
 * @throws {OIDCError} With type AccessTokenRequestFailed if the token request fails
 *
 * @example
 * ```typescript
 * try {
 *   const { accessToken } = await requestOidcToken({
 *     redirectCallbackUri: 'https://smarttrader.deriv.com/en/callback'
 *   });
 *
 *   // Use the access token for authenticated API calls
 * } catch (error) {
 *   // Handle token request error
 * }
 * ```
 *
 * @remarks
 * - This function should be called on the callback page/route of your application
 * - The function expects the OIDC callback parameters to be present in the URL
 * - The access token can be null if the authentication flow fails or is cancelled
 */
export const requestOidcToken = async (options: RequestOidcTokenOptions) => {
    const { redirectCallbackUri, postLogoutRedirectUri } = options;

    try {
        const userManager = await createUserManager({
            redirectCallbackUri,
            postLogoutRedirectUri,
        });

        const user = await userManager.signinCallback();

        return {
            accessToken: user?.access_token,
        };
    } catch (error) {
        console.error('unable to request access tokens: ', error);
        if (error instanceof Error) throw new OIDCError(OIDCErrorType.AccessTokenRequestFailed, error.message);
        throw new OIDCError(OIDCErrorType.AccessTokenRequestFailed, 'unable to request access tokens');
    }
};

/**
 * Fetches the tokens that will be passed to the `authorize` endpoint.
 *
 * @param {string} accessToken The access token received after calling `requestOidcToken` successfully
 */

/**
 * Fetches the tokens that will be passed to the `authorize` endpoint.
 *
 * @param {string} accessToken - The OAuth2/OIDC access token obtained from `requestOidcToken` function
 * @returns {Promise<LegacyTokens>} A promise that resolves to an object containing the legacy tokens
 *
 * @throws {OIDCError} With type LegacyTokenRequestFailed if the request fails
 *
 * @example
 * ```typescript
 * // YourCallbackPage.tsx
 * try {
 *   const { accessToken } = await requestOidcToken(...)
 *
 *   const legacyTokens = await requestLegacyToken(accessToken);
 *
 * } catch (error) {
 *   // Handle legacy token request error
 * }
 * ```
 */
export const requestLegacyToken = async (accessToken: string): Promise<LegacyTokens> => {
    const { serverUrl } = getServerInfo();

    try {
        const response = await fetch(`https://${serverUrl}/oauth2/legacy/tokens`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const data = await response.json();

        return data;
    } catch (error) {
        console.error('unable to request legacy tokens: ', error);
        if (error instanceof Error) throw new OIDCError(OIDCErrorType.LegacyTokenRequestFailed, error.message);
        throw new OIDCError(OIDCErrorType.LegacyTokenRequestFailed, 'unable to request legacy tokens');
    }
};

/**
 * Initiates a silent login process only when:
 * - User must have previously logged in (checked via 'logged_state' cookie set to `true`)
 * - Current page is not a callback/endpoint page
 * - Client accounts data in localStorage does not exist
 *
 * @async
 * @param {Object} options - Configuration options for the silent login request
 * @param {string} options.clientAccounts - The client accounts data. This must be retrieved on your side using your app's preferred storage method (localStorage or sessionStorage)
 * @param {string} options.redirectCallbackUri - The URI path for redirect callback after authentication
 * @param {string} [options.endpointUri] - Optional URI path to exclude from silent login attempts
 *
 * @example
 *
 * const clientAccounts = JSON.parse(localStorage.getItem('client.accounts') || '{}')
 * await requestSilentLogin({
 *   clientAccounts: clientAccounts,
 *   redirectCallbackUri: `${window.location.origin}/callback`,
 *   endpointUri: '/endpoint'
 * });
 *
 * @throws {Error} May throw errors from requestOidcAuthentication if authentication fails
 * @returns {Promise<void>} Returns a Promise that resolves when the authentication process is complete
 */
export const requestSilentLogin = async (options: RequestSilentLoginOptions) => {
    const isLoggedInCookie = Cookies.get('logged_state') === 'true';
    // The reason why we are asking the user to pass in the entire client.accounts object is because they may store the data in either localStorage or sessionStorage
    const isClientAccountsPopulated = Object.keys(options.clientAccounts).length > 0;
    const isCallbackPage = window.location.href.startsWith(options.redirectCallbackUri);
    const isEndpointPage = options.endpointUri ? window.location.pathname.includes(options.endpointUri) : false;

    // we only do SSO if:
    // we have previously logged-in before from SmartTrader or any other apps (Deriv.app, etc) - isLoggedInCookie
    // if we are not in the callback route to prevent re-calling this function - !isCallbackPage
    // if client.accounts in localStorage is empty - !isClientAccountsPopulated
    // and if feature flag for OIDC Phase 2 is enabled - isAuthEnabled
    if (isLoggedInCookie && !isCallbackPage && !isEndpointPage && !isClientAccountsPopulated) {
        await requestOidcAuthentication({
            redirectCallbackUri: options.redirectCallbackUri,
        });
    }
};

/**
 * Creates a UserManager instance that will be used to manage and call the OIDC flow
 * @param options - Configuration options for the OIDC token request
 * @param options.redirectCallbackUri - The callback page URI to redirect back
 * @param options.postLogoutRedirectUri - The URI to redirect after logging out
 */
export const createUserManager = async (options: CreateUserManagerOptions) => {
    const { redirectCallbackUri, postLogoutRedirectUri } = options;
    const { appId } = getServerInfo();

    const { postLogoutRedirectUri: postLogoutRedirectUriFromStorage } = getConfigurations();

    // if the user does not provide a redirectUri, default to /callback route as the redirect URI
    const _redirectUri = redirectCallbackUri || `${window.location.origin}/callback`;
    const _postLogoutRedirectUri = postLogoutRedirectUri || postLogoutRedirectUriFromStorage || window.location.origin;

    try {
        const oidc_config = await fetchOidcConfiguration();
        const userManager = new UserManager({
            authority: oidc_config.issuer,
            client_id: appId,
            redirect_uri: _redirectUri,
            response_type: 'code',
            scope: 'openid',
            stateStore: new WebStorageStateStore({ store: window.localStorage }),
            post_logout_redirect_uri: _postLogoutRedirectUri,
        });
        return userManager;
    } catch (error) {
        console.error('unable to create user manager for OIDC: ', error);
        if (error instanceof Error) throw new OIDCError(OIDCErrorType.UserManagerCreationFailed, error.message);
        throw new OIDCError(OIDCErrorType.UserManagerCreationFailed, 'unable to create user manager for OIDC');
    }
};
