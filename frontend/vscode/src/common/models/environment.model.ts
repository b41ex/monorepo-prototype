import { ENVIRONMENT_FAILURE, ENVIRONMENT_LOADING, ENVIRONMENT_SUCCESS, EnvironmentConnectionState } from '../constants/environment.constants';
import {
    EnvironmentWebviewTestConnectionDto,
    WebviewMessage,
    WebviewMessages,
    WebviewPayloadType
} from './webview.model';

export enum EnvironmentWebviewFields {
    URL = 'url',
    TOKEN = 'token',
    TEST_CONNECTION_BUTTON = 'testConnectionButton',
    TEST_CONNECTION_ICON = 'testConnectionIcon'
}

export enum EnvironmentWebviewMessages {
    TEST_CONNECTION = 'testConnection'
}

export interface EnvironmentWebviewDto
    extends WebviewMessage<
        WebviewMessages | EnvironmentWebviewMessages,
        WebviewPayloadType | EnvironmentWebviewTestConnectionDto
    > {}

export const EnvironmentWebviewIconsMapper = new Map<EnvironmentConnectionState, string>([
    [ENVIRONMENT_LOADING, 'loading'],
    [ENVIRONMENT_SUCCESS, 'check'],
    [ENVIRONMENT_FAILURE, 'close'],
    ['', '']
]);
