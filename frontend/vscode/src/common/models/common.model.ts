export type WorkfolderPath = string;
export type FilePath = string;

export interface ServerStatusDto {
    backendVersion: string;
    frontendVersion: string;
    productionMode: boolean;
    externalLinks: string[];
}

export interface DefaultError {
    message: string;
    stack: string;
    cause?: { code: string };
    code?: number;
}

export class CrudError extends Error {
    constructor(readonly message: string, readonly code: string, readonly debug: string, readonly status?: number) {
        super(message);
    }
}
export interface CrudResponse {
    code?: string;
    debug?: string;
    message?: string;
    status?: number;
}
