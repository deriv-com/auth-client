export class OIDCError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OIDCError';
    }
}

export const OIDCAuthenticationError = {
    FailedToFetchOIDCConfiguration: new OIDCError('Failed to fetch OIDC configuration'),
    AuthenticationRequestFailed: new OIDCError('Authentication request failed'),
    AccessTokenRequestFailed: new OIDCError('Unable to request access tokens'),
    LegacyTokenRequestFailed: new OIDCError('Unable to request legacy tokens'),
    UserManagerCreationFailed: new OIDCError('Unable to create user manager for OIDC'),
};
