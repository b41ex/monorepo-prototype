import { Disposable, Event, EventEmitter, TextEditor, window, workspace } from 'vscode';
import { getWorkspaceFolders } from '../../utils/path.utils';
import { WorkfolderPath } from '../models/common.model';

export class WorkspaceService extends Disposable {
    private _disposables: Disposable[] = [];
    private _activeWorkfolderPath: WorkfolderPath = '';
    private _workfolderPaths: WorkfolderPath[] = [];
    private _listeners = new Map<string, Disposable>();
    private readonly _onDidChangeActiveWorkspace: EventEmitter<WorkfolderPath> = new EventEmitter();
    private readonly onDidChangeActiveWorkspace: Event<WorkfolderPath> = this._onDidChangeActiveWorkspace.event;

    constructor() {
        super(() => this.dispose());
    }

    public subscribe(listenerName: string, listener: (value: WorkfolderPath) => void): void {
        if (this._listeners.has(listenerName)) {
            return;
        }
        if (!this._listeners.size) {
            this.initializeWorkspace();
        }
        const disposable = this.onDidChangeActiveWorkspace(listener, this, this._disposables);
        this._listeners.set(listenerName, disposable);
    }

    public unsubscribe(listenerName: string): void {
        const listener = this._listeners.get(listenerName);
        if (listener) {
            listener.dispose();
            this._listeners.delete(listenerName);
        }

        if (!this._listeners.size) {
            this.dispose();
        }
    }

    public get activeWorkfolderPath(): WorkfolderPath {
        return this._activeWorkfolderPath;
    }

    public dispose(): void {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
        this._listeners.forEach((listener) => listener.dispose());
        this._listeners.clear();
    }

    private initializeWorkspace(): void {
        this.updateWorkfolderPaths();
        this.subscribeToWorkspaceChanges();
    }

    private updateWorkfolderPaths(): void {
        this._workfolderPaths = getWorkspaceFolders();
        this._activeWorkfolderPath = this.determineActiveWorkspace();
    }

    private subscribeToWorkspaceChanges(): void {
        window.onDidChangeActiveTextEditor(this.handleActiveEditorChange.bind(this), this, this._disposables);
        workspace.onDidChangeWorkspaceFolders(this.updateWorkfolderPaths.bind(this), this, this._disposables);
    }

    private handleActiveEditorChange(editor: TextEditor | undefined): void {
        if (!editor || this._workfolderPaths.length === 1) {
            return;
        }
        const newActiveWorkspace = this.determineActiveWorkspace();
        if (newActiveWorkspace !== this._activeWorkfolderPath) {
            this._activeWorkfolderPath = newActiveWorkspace;
            this._onDidChangeActiveWorkspace.fire(this._activeWorkfolderPath);
        }
    }

    private determineActiveWorkspace(): WorkfolderPath {
        const fileUri = window.activeTextEditor?.document.uri;
        if (fileUri) {
            return workspace.getWorkspaceFolder(fileUri)?.uri.fsPath ?? this._workfolderPaths[0];
        }
        return this._workfolderPaths[0];
    }
}
