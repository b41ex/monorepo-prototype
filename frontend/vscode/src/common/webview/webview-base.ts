import { CancellationToken, Disposable, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from 'vscode';
import { WebviewMessages, WebviewOption, WebviewPayloadType } from '../models/webview.model';

export abstract class WebviewBase<T> extends Disposable implements WebviewViewProvider {
    protected _view?: WebviewView;
    protected _disposables: Disposable[] = [];

    abstract resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext,
        token: CancellationToken
    ): Thenable<void> | void;

    constructor(callOnDispose?: () => any) {
        super(() => callOnDispose?.());
    }

    public dispose(): void {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
    }

    protected updateWebviewField(field: T, value: string | string[]): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_FIELD, field, value);
    }

    protected updateWebviewOptions(field: T, value: WebviewOption[]): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_OPTIONS, field, value);
    }

    protected updateWebviewPattern(field: T, value: string): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_PATTERN, field, value);
    }

    protected updateWebviewDisable(field: T, value: boolean): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_DISABLE, field, value.toString());
    }

    protected updateWebviewRequired(field: T, value: boolean = true): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_REQUIRED, field, value.toString());
    }

    protected updateWebviewSpin(field: T, value: boolean = true): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_SPIN, field, value.toString());
    }

    protected updateWebviewIcon(field: T, value: string): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_ICON, field, value);
    }

    protected updateWebviewInvalid(field: T, value: boolean = true): void {
        this.sendWebviewMessage(WebviewMessages.UPDATE_INVALID, field, value.toString());
    }

    private sendWebviewMessage(command: WebviewMessages, field: T, value: WebviewPayloadType): void {
        this._view?.webview.postMessage({
            command,
            payload: {
                field,
                value
            }
        });
    }
}
