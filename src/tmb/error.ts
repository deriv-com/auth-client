export enum TMBErrorType {
    FailedFetchSessionsActive = 'FailedFetchSessionsActive',
    FailedFetchSessionsRefresh = 'FailedFetchSessionsRefresh',
    FailedFetchSessionsLogout = 'FailedFetchSessionsLogout',
}

export class TMBError extends Error {
    type?: TMBErrorType;

    constructor(type: TMBErrorType, message: string) {
        super(message);
        this.name = type;
        this.type = type;
    }
}
