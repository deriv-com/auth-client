import {
    AppIDConstants,
    LocalStorageConstants,
    LocalStorageUtils,
    URLConstants,
    URLUtils,
    WebSocketUtils,
} from '@deriv-com/utils';

export const DEFAULT_OAUTH_LOGOUT_URL = 'https://oauth.deriv.com/oauth2/sessions/logout';

export const DEFAULT_OAUTH_ORIGIN_URL = 'https://oauth.deriv.com';

const SocketURL = {
    [URLConstants.derivP2pProduction]: 'blue.derivws.com',
    [URLConstants.derivP2pStaging]: 'red.derivws.com',
};

export const getServerInfo = () => {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const { getAppId } = WebSocketUtils;

    const appIdFromUtils = getAppId();

    const existingAppId = LocalStorageUtils.getValue<string>(LocalStorageConstants.configAppId);
    const existingServerUrl = LocalStorageUtils.getValue<string>(LocalStorageConstants.configServerURL);
    // since we don't have official app_id for staging,
    // we will use the red server with app_id=62019 for the staging-p2p.deriv.com for now
    // to fix the login issue
    if (origin === URLConstants.derivP2pStaging && (!existingAppId || !existingServerUrl)) {
        LocalStorageUtils.setValue<string>(
            LocalStorageConstants.configServerURL,
            SocketURL[origin as keyof typeof SocketURL]
        );
        LocalStorageUtils.setValue<string>(
            LocalStorageConstants.configAppId,
            `${AppIDConstants.domainAppId[hostname as keyof typeof AppIDConstants.domainAppId]}`
        );
    }

    const storedServerUrl =
        LocalStorageUtils.getValue<string>(LocalStorageConstants.configServerURL) ||
        localStorage.getItem('config.server_url');

    // Determine server URL based on domain
    let serverUrl = 'oauth.deriv.com'; // default fallback

    if (storedServerUrl && /qa/.test(String(storedServerUrl))) {
        serverUrl = storedServerUrl;
    } else if (hostname.includes('.deriv.me')) {
        serverUrl = 'oauth.deriv.me';
    } else if (hostname.includes('.deriv.be')) {
        serverUrl = 'oauth.deriv.be';
    }

    const appId = LocalStorageUtils.getValue<string>(LocalStorageConstants.configAppId) || appIdFromUtils;
    const lang = LocalStorageUtils.getValue<string>(LocalStorageConstants.i18nLanguage);

    return {
        appId,
        lang,
        serverUrl,
    };
};

export const getOauthUrl = () => {
    const { appId, lang, serverUrl } = getServerInfo();

    const oauthUrl =
        appId && serverUrl
            ? `https://${serverUrl}/oauth2/authorize?app_id=${appId}&l=${lang ?? 'EN'}&brand=deriv`
            : URLUtils.getOauthURL();

    return oauthUrl;
};

export const getOAuthLogoutUrl = () => {
    const { appId, serverUrl } = getServerInfo();

    const oauthUrl = appId && serverUrl ? `https://${serverUrl}/oauth2/sessions/logout` : DEFAULT_OAUTH_LOGOUT_URL;

    return oauthUrl;
};

export const getOAuthOrigin = () => {
    const { appId, serverUrl } = getServerInfo();

    const oauthUrl = appId && serverUrl ? `https://${serverUrl}` : DEFAULT_OAUTH_ORIGIN_URL;

    return oauthUrl;
};
