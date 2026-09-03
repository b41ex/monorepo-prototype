import {
    CancellationToken,
    commands,
    ExtensionContext,
    Webview,
    WebviewView,
    WebviewViewResolveContext,
    window
} from 'vscode';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import { normalizeUrl } from '../../utils/path.utils';
import {
    ABORTED_ERROR_CODE,
    EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME,
    MAIN_JS_PATH
} from '../constants/common.constants';
import { ENVIRONMENT_FAILURE, ENVIRONMENT_JS_PATH, ENVIRONMENT_LOADING, ENVIRONMENT_SUCCESS, EnvironmentConnectionState } from '../constants/environment.constants';
import { CrudService, RequestNames } from '../cruds/crud.service';
import { CrudError } from '../models/common.model';
import {
    EnvironmentWebviewDto,
    EnvironmentWebviewFields,
    EnvironmentWebviewIconsMapper,
    EnvironmentWebviewMessages
} from '../models/environment.model';
import { EnvironmentWebviewTestConnectionDto, WebviewMessages, WebviewPayload } from '../models/webview.model';
import { EnvironmentStorageService } from '../services/environment-storage.service';
import { WebviewBase } from './webview-base';
import { PublishingService } from '../services/publishing.service';

export class EnvironmentViewProvider extends WebviewBase<EnvironmentWebviewFields> {
    constructor(
        private readonly context: ExtensionContext,
        private readonly crudService: CrudService,
        private readonly environmentStorageService: EnvironmentStorageService,
        private readonly publishingService: PublishingService
    ) {
        super();
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext<ExtensionContext>,
        _token: CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;
        this.initializeWebview(webviewView);
        this.subscribeToEvents();
    }

    private initializeWebview(webviewView: WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    }

    private subscribeToEvents(): void {
        this._view?.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this));
        this._disposables.push(
            commands.registerCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME, () => {
                this._view?.show();
                this.markFieldsAsRequired([EnvironmentWebviewFields.URL, EnvironmentWebviewFields.TOKEN]);
            })
        );
        this.publishingService.onPublish(
            (isPublishingProgress) => this.disableAllFields(isPublishingProgress),
            this,
            this._disposables
        );
    }

    private handleWebviewMessage(data: EnvironmentWebviewDto): void {
        this.crudService.abort(RequestNames.GET_SYSTEM_INFO);
        this.cleanInvalidFields();

        switch (data.command) {
            case WebviewMessages.UPDATE_FIELD:
                this.updateField(data.payload as WebviewPayload<EnvironmentWebviewFields>);
                break;
            case WebviewMessages.REQUEST_FIELD:
                this.requestField(data.payload as WebviewPayload<EnvironmentWebviewFields>);
                break;
            case EnvironmentWebviewMessages.TEST_CONNECTION:
                this.testConnection(data.payload as EnvironmentWebviewTestConnectionDto);
                break;
        }
    }

    private disableAllFields(disable: boolean = true): void {
        const fields = [EnvironmentWebviewFields.URL, EnvironmentWebviewFields.TOKEN];
        fields.forEach((field) => this.updateWebviewDisable(field, disable));
    }

    private async testConnection(data: EnvironmentWebviewTestConnectionDto): Promise<void> {
        this.cleanInvalidFields();
        this.setTestConnectionState(ENVIRONMENT_LOADING);

        let { host, token } = data;
        host = normalizeUrl(host);
        if (!host) {
            this.markFieldAsInvalid(EnvironmentWebviewFields.URL);
            this.setTestConnectionState(ENVIRONMENT_FAILURE);
            return;
        }

        try {
            await this.crudService.getSystemInfo(host, token);
            this.setTestConnectionState(ENVIRONMENT_SUCCESS);
        } catch (error) {
            this.handleTestConnectionError(error as CrudError);
        }
    }

    private handleTestConnectionError(error: CrudError): void {
        switch (error.status) {
            case ABORTED_ERROR_CODE:
                break;
            case 401:
                this.markFieldAsInvalid(EnvironmentWebviewFields.TOKEN);
                this.setTestConnectionState(ENVIRONMENT_FAILURE);
                break;
            default:
                this.markFieldAsInvalid(EnvironmentWebviewFields.URL);
                this.setTestConnectionState(ENVIRONMENT_FAILURE);
                break;
        }
    }

    private async updateField(payload: WebviewPayload<EnvironmentWebviewFields>): Promise<void> {
        switch (payload.field) {
            case EnvironmentWebviewFields.URL:
                const host = normalizeUrl(payload.value as string);
                await this.environmentStorageService.setHost(host);
                this.markFieldAsRequired(EnvironmentWebviewFields.URL);
                this.markFieldAsInvalid(EnvironmentWebviewFields.URL, !host?.length);
                break;
            case EnvironmentWebviewFields.TOKEN:
                const token = (payload.value as string)?.trim();
                await this.environmentStorageService.setToken(token ?? '');
                this.markFieldAsRequired(EnvironmentWebviewFields.TOKEN);
                break;
        }
    }

    private requestField(payload: WebviewPayload<EnvironmentWebviewFields>): void {
        switch (payload.field) {
            case EnvironmentWebviewFields.URL:
                this.requestHost();
                break;
            case EnvironmentWebviewFields.TOKEN:
                this.requestToken();
                break;
        }
    }

    private async requestHost(): Promise<void> {
        const { host } = await this.environmentStorageService.getEnvironment();
        this.updateWebviewField(EnvironmentWebviewFields.URL, host);
    }

    private async requestToken(): Promise<void> {
        const { token } = await this.environmentStorageService.getEnvironment();
        this.updateWebviewField(EnvironmentWebviewFields.TOKEN, token);
    }

    private cleanInvalidFields(): void {
        this.setTestConnectionState('');
        this.markFieldAsInvalid(EnvironmentWebviewFields.TOKEN, false);
        this.markFieldAsInvalid(EnvironmentWebviewFields.URL, false);
    }

    private setTestConnectionState(state: EnvironmentConnectionState): void {
        this.updateWebviewIcon(
            EnvironmentWebviewFields.TEST_CONNECTION_ICON,
            EnvironmentWebviewIconsMapper.get(state) ?? ''
        );
        this.updateWebviewSpin(EnvironmentWebviewFields.TEST_CONNECTION_ICON, state === 'loading');
    }

    private markFieldsAsRequired(fields: EnvironmentWebviewFields[]): void {
        fields.forEach((field) => this.updateWebviewRequired(field));
    }

    private markFieldAsRequired(field: EnvironmentWebviewFields): void {
        this.updateWebviewRequired(field);
    }

    private markFieldAsInvalid(field: EnvironmentWebviewFields, invalid: boolean = true): void {
        this.updateWebviewInvalid(field, invalid);
    }

    private getHtmlForWebview(webview: Webview): string {
        const extensionUri = this.context.extensionUri;

        const mainJsUrl = webview.asWebviewUri(getJsScript(extensionUri, MAIN_JS_PATH));
        const scriptUri = webview.asWebviewUri(getJsScript(extensionUri, ENVIRONMENT_JS_PATH));
        const styleUri = webview.asWebviewUri(getStyle(extensionUri));
        const elementsUri = webview.asWebviewUri(getElements(extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(extensionUri));
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>APIHUB Environment View</title>
                <link href="${codiconsUri}" rel="stylesheet" id="vscode-codicon-stylesheet"/>
                <link href="${styleUri}" rel="stylesheet"/>
            </head>
            <body>
                <vscode-form-group variant="vertical">
                    <p>
                        <vscode-label for="${EnvironmentWebviewFields.URL}" required>APIHUB URL:</vscode-label>
                        <vscode-textfield id="${EnvironmentWebviewFields.URL}"/>
                    </p>
                    <p>
                        <vscode-label for="${EnvironmentWebviewFields.TOKEN}" required>Authentication Token:</vscode-label>
                        <vscode-textfield id="${EnvironmentWebviewFields.TOKEN}" type="password">
                            <vscode-icon
                                id="eye-icon"
                                slot="content-after"
                                name="eye"
                                title="clear-all"
                                action-icon
                            ></vscode-icon>
                        </vscode-textfield>
                    </p>
                    <p class="environment-connection">
                        <a href="" id="${EnvironmentWebviewFields.TEST_CONNECTION_BUTTON}">Test Connection</a>
                        <vscode-icon class='environment-connection-icon' id="${EnvironmentWebviewFields.TEST_CONNECTION_ICON}"></vscode-icon>
                    </p>
                </vscode-form-group>
                <script nonce="${nonce}" src="${elementsUri}" type="module"></script>
                <script nonce="${nonce}" src="${mainJsUrl}"></script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
        </html>`;
    }
}
