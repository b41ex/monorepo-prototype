import path from 'path';
import {
    commands,
    Disposable,
    ExtensionContext,
    TreeCheckboxChangeEvent,
    TreeItemCheckboxState,
    TreeView,
    TreeViewVisibilityChangeEvent,
    Uri,
    ViewColumn,
    window
} from 'vscode';
import {
    EXTENSION_ENVIRONMENT_VIEW_NAME,
    EXTENSION_EXPLORER_NAME,
    EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
    EXTENSION_PUBLISH_VIEW_NAME,
    SHOW_README_ACTION_NAME
} from './common/constants/common.constants';
import { CrudService } from './common/cruds/crud.service';
import { SpecificationItem } from './common/models/specification-item';
import { ConfigurationFileService } from './common/services/configuration-file.service';
import { EnvironmentStorageService } from './common/services/environment-storage.service';
import { ItemCheckboxService } from './common/services/Item-checkbox.service';
import { PublishingService } from './common/services/publishing.service';
import { WorkspaceService } from './common/services/workspace.service';
import { EnvironmentViewProvider } from './common/webview/environment-view';
import { PublishingViewProvider } from './common/webview/publishing-view';
import { SpecificationFileTreeProvider } from './common/specification-tree/specification-tree-provider';

export function activate(context: ExtensionContext): void {
    const workspaceFolderService = registerDisposable(context, new WorkspaceService());
    const itemCheckboxService = new ItemCheckboxService();
    const environmentStorageService = new EnvironmentStorageService(context);
    const configurationFileService = registerDisposable(context, new ConfigurationFileService());

    const fileTreeProvider = new SpecificationFileTreeProvider(
        workspaceFolderService,
        itemCheckboxService,
        configurationFileService
    );
    const treeView = registerTreeView(context, EXTENSION_EXPLORER_NAME, fileTreeProvider);

    registerTreeViewEvents(context, treeView, fileTreeProvider, workspaceFolderService, itemCheckboxService);
    registerCommands(context);

    const crudService = registerDisposable(context, new CrudService());
    const publishingService = registerDisposable(
        context,
        new PublishingService(fileTreeProvider, environmentStorageService, configurationFileService)
    );

    registerWebviewProviders(
        context,
        crudService,
        environmentStorageService,
        configurationFileService,
        workspaceFolderService,
        publishingService
    );
}

export function deactivate(): void {}

function registerDisposable<T extends Disposable>(context: ExtensionContext, disposable: T): T {
    context.subscriptions.push(disposable);
    return disposable;
}

function registerTreeView(
    context: ExtensionContext,
    viewId: string,
    treeDataProvider: SpecificationFileTreeProvider
): TreeView<SpecificationItem> {
    return registerDisposable(context, window.createTreeView(viewId, { treeDataProvider }));
}

function registerTreeViewEvents(
    context: ExtensionContext,
    treeView: ReturnType<typeof window.createTreeView>,
    fileTreeProvider: SpecificationFileTreeProvider,
    workspaceFolderService: WorkspaceService,
    itemCheckboxService: ItemCheckboxService
): void {
    registerDisposable(
        context,
        treeView.onDidChangeVisibility((event: TreeViewVisibilityChangeEvent) =>
            fileTreeProvider.activate(event.visible)
        )
    );

    registerDisposable(
        context,
        treeView.onDidChangeCheckboxState((event: TreeCheckboxChangeEvent<unknown>) => {
            const { items } = event as TreeCheckboxChangeEvent<SpecificationItem>;
            const workspace = workspaceFolderService.activeWorkfolderPath;
            items.forEach(([item, checked]) =>
                checked === TreeItemCheckboxState.Checked
                    ? itemCheckboxService.add(workspace, item.uri.fsPath)
                    : itemCheckboxService.delete(workspace, item.uri.fsPath)
            );
        })
    );
}

function registerCommands(context: ExtensionContext): void {
    context.subscriptions.push(
        commands.registerCommand(
            EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
            async (resource: Uri) => await window.showTextDocument(resource, { viewColumn: ViewColumn.One })
        )
    );

    context.subscriptions.push(
        commands.registerCommand(SHOW_README_ACTION_NAME, (fragment: string) => {
            const readmeUri = Uri.file(path.join(context.extensionPath, 'README.md')).with({ fragment });
            commands.executeCommand('markdown.showPreview', readmeUri);
        })
    );
}

function registerWebviewProviders(
    context: ExtensionContext,
    crudService: CrudService,
    environmentStorageService: EnvironmentStorageService,
    configurationFileService: ConfigurationFileService,
    workspaceFolderService: WorkspaceService,
    publishingService: PublishingService
): void {
    const publishingViewProvider = registerDisposable(
        context,
        new PublishingViewProvider(
            context,
            crudService,
            environmentStorageService,
            configurationFileService,
            workspaceFolderService,
            publishingService
        )
    );
    registerDisposable(context, window.registerWebviewViewProvider(EXTENSION_PUBLISH_VIEW_NAME, publishingViewProvider));

    const environmentViewProvider = registerDisposable(
        context,
        new EnvironmentViewProvider(context, crudService, environmentStorageService, publishingService)
    );

    registerDisposable(
        context,
        window.registerWebviewViewProvider(EXTENSION_ENVIRONMENT_VIEW_NAME, environmentViewProvider)
    );
}
