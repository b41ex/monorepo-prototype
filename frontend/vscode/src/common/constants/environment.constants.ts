export const ENVIRONMENT_JS_PATH = 'environment.js';
export type EnvironmentConnectionState =
    | typeof ENVIRONMENT_LOADING
    | typeof ENVIRONMENT_SUCCESS
    | typeof ENVIRONMENT_FAILURE
    | typeof ENVIRONMENT_EMPTY;
export const ENVIRONMENT_LOADING = 'loading';
export const ENVIRONMENT_SUCCESS = 'success';
export const ENVIRONMENT_FAILURE = 'failure';
export const ENVIRONMENT_EMPTY = '';
