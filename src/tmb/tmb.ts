import { TMBError, TMBErrorType } from './error';
import { getServerInfo } from '../constants';

export type TMBWebsocketTokens = {
    "active": boolean,
    "exp": string,
    "tokens": [
        {
            "cur": string,
            "loginid": string,
            "token": string
        },
        {
            "cur": string,
            "loginid": string,
            "token": string
        }
    ]
};

export type TMBLogoutResponse = {
    "active": boolean,
}

/**
 * Requests the active sessions from the server.
 *
 * @returns {Promise<TMBLogoutResponse>} - A promise that resolves to the logout response.
 * @throws {TMBError} - Throws an error if the request fails.
 */
export const requestSessionActive = async (): Promise<TMBWebsocketTokens> => {
    const { serverUrl } = getServerInfo();

    try {
        const response = await fetch(`https://${serverUrl}/oauth2/sessions/active`, {
            method: 'GET',
            credentials: 'include',
        });
        const data = await response.json();

        return data;
    } catch (error) {
        console.error('unable to request sessions active: ', error);
        if (error instanceof Error) throw new TMBError(TMBErrorType.FailedFetchSessionsActive, error.message);
        throw new TMBError(TMBErrorType.FailedFetchSessionsActive, 'unable to request sessions active');
    }
};

/**
 * Requests to invalidate cache of active sessions.
 *
 * @returns {Promise<TMBLogoutResponse>} - A promise that resolves to the logout response.
 * @throws {TMBError} - Throws an error if the request fails.
 */
export const requestSessionRefresh = async (): Promise<TMBWebsocketTokens> => {
    const { serverUrl } = getServerInfo();

    try {
        const response = await fetch(`https://${serverUrl}/oauth2/sessions/refresh`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await response.json();

        return data;
    } catch (error) {
        console.error('unable to request sessions active: ', error);
        if (error instanceof Error) throw new TMBError(TMBErrorType.FailedFetchSessionsActive, error.message);
        throw new TMBError(TMBErrorType.FailedFetchSessionsActive, 'unable to request sessions active');
    }
};
