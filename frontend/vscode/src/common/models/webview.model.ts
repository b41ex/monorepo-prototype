export type WebviewCommandName = string;
export type WebviewPayloadType = void | string | string[] | object;
export interface WebviewMessage<C extends WebviewCommandName, T extends WebviewPayloadType> {
    command: C;
    payload: T;
}

export enum WebviewMessages {
    UPDATE_OPTIONS = 'updateOptions',
    UPDATE_FIELD = 'updateField',
    UPDATE_PATTERN = 'updatePattern',
    REQUEST_FIELD = 'requestField',
    REQUEST_OPTIONS = 'requestOptions',
    DELETE = 'delete',
    UPDATE_DISABLE = 'updateDisable',
    UPDATE_REQUIRED = 'updateRequired',
    UPDATE_INVALID = 'updateInvalid',
    UPDATE_ICON = 'updateIcon',
    UPDATE_SPIN = 'updateSpin'
}

export interface WebviewOption {
    name: string;
    disabled: boolean;
    selected: boolean;
    label?: string;
}

export interface WebviewPayload<T> {
    field: T;
    value: string | string[] | void;
}
export interface EnvironmentWebviewTestConnectionDto {
    token: string;
    host: string;
}
