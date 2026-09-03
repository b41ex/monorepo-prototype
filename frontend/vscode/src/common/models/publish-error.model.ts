export enum PublishingErrorTypes {
    ERROR = 'error',
    INFO = 'info'
}

export class PublishingError extends Error {
    constructor(
        readonly message: string,
        readonly type: PublishingErrorTypes,
        readonly buttonName?: string,
        readonly link?: string
    ) {
        super(message);
    }
}
