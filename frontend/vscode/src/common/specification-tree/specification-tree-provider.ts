import fs, { Dirent } from 'fs';
import path from 'path';
import {
    Disposable,
    Event,
    EventEmitter,
    FileSystemWatcher,
    TreeDataProvider,
    TreeItemCheckboxState,
    Uri,
    window,
    workspace
} from 'vscode';
import {
    IGNORE_DIRS,
    OPENAPI_SPEC_KEY_REGEXP,
    SPECIFICATION_TREE,
    SPECS_ADDITIONAL_EXTENSIONS,
    SPECS_MAIN_EXTENSIONS
} from '../constants/specification.constants';
import { FilePath, WorkfolderPath } from '../models/common.model';
import { SpecificationItem, SpecificationTreeData } from '../models/specification-item';
import { ItemCheckboxService } from '../services/Item-checkbox.service';
import { ConfigurationFileService } from '../services/configuration-file.service';
import { WorkspaceService } from '../services/workspace.service';
import { isPathExists } from '../../utils/files.utils';
import { getExtension, isApiSpecFile } from '../../utils/path.utils';

export class SpecificationFileTreeProvider extends Disposable implements TreeDataProvider<SpecificationItem> {
    private readonly _onDidChangeTreeData: EventEmitter<void> = new EventEmitter();
    public readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event;
    private _disposables: Disposable[] = [];
    private readonly _watcher: FileSystemWatcher;

    private readonly _specificationFileData: Map<WorkfolderPath, SpecificationTreeData> = new Map();

    constructor(
        private readonly workspaceFolderService: WorkspaceService,
        private readonly itemCheckboxService: ItemCheckboxService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        super(() => this.dispose());
        const apiSpecFileExtensions: string = [...SPECS_MAIN_EXTENSIONS, ...SPECS_ADDITIONAL_EXTENSIONS].join(',');
        this._watcher = workspace.createFileSystemWatcher(`**/*.{${apiSpecFileExtensions}}`);
    }

    public activate(active: boolean): void {
        if (active) {
            this.subscribeChanges();
            const activeWorkspace = this.workspaceFolderService.activeWorkfolderPath;
            this.setFilesFromConfig(activeWorkspace);
            this.refresh();
        } else {
            this.dispose();
        }
    }

    public getTreeItem(element: SpecificationItem): SpecificationItem {
        return element;
    }

    public getChildren(): Thenable<SpecificationItem[]> {
        const workspace = this.workspaceFolderService.activeWorkfolderPath;
        return this.getChildrenFromWorkspace(workspace);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public async getFilesForPublishing(): Promise<SpecificationItem[]> {
        const activeWorkspace = this.workspaceFolderService.activeWorkfolderPath;
        this.setFilesFromConfig(activeWorkspace);
        const items = await this.getChildrenFromWorkspace(activeWorkspace);
        return await Promise.all(
            items
                .filter((item) => item.checkboxState === TreeItemCheckboxState.Checked)
                .filter(async (item: SpecificationItem) => isPathExists(item.uri.fsPath))
        );
    }

    public dispose(): void {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
        this.workspaceFolderService.unsubscribe(SPECIFICATION_TREE);
        this.configurationFileService.unsubscribe(SPECIFICATION_TREE);
    }

    private getChildrenFromWorkspace(workspace: WorkfolderPath): Thenable<SpecificationItem[]> {
        if (!workspace) {
            window.showInformationMessage('No specifications in empty workspace');
            return Promise.resolve([]);
        }
        if (!isPathExists(workspace)) {
            window.showInformationMessage(`Invalid path for ${workspace}`);
            return Promise.resolve([]);
        }
        const { configFiles, localFiles } = this.getSpecificationFileData(workspace);
        const configFileExist = !!configFiles?.size;
        return Promise.resolve(
            this.sortSpecificationItems(
                this.readSpecificationFiles(workspace, workspace, localFiles, configFiles, configFileExist)
            )
        );
    }

    private readSpecificationFiles(
        dirPath: string,
        workfolderPath: WorkfolderPath,
        localFiles: Set<FilePath>,
        configFiles: Set<FilePath>,
        configFileExist: boolean
    ): SpecificationItem[] {
        const specItems: SpecificationItem[] = [];
        const dirents: Dirent[] = fs.readdirSync(dirPath, { withFileTypes: true });

        dirents.forEach((dirent) => {
            const filePath = path.join(dirPath, dirent.name);

            if (this.shouldIgnoreDirent(dirent, filePath, configFiles)) {
                return;
            }

            if (dirent.isDirectory()) {
                specItems.push(
                    ...this.readSpecificationFiles(filePath, workfolderPath, localFiles, configFiles, configFileExist)
                );
            } else if (dirent.isFile()) {
                const selected = this.calculateItemSelected(workfolderPath, filePath, localFiles, configFiles, configFileExist);
                specItems.push(
                    new SpecificationItem(
                        dirent.name,
                        dirPath,
                        Uri.file(filePath),
                        workfolderPath,
                        selected ? TreeItemCheckboxState.Checked : TreeItemCheckboxState.Unchecked
                    )
                );
                localFiles.add(filePath);
            }
        });

        return specItems;
    }

    private shouldIgnoreDirent(dirent: Dirent, filePath: string, configFiles: Set<FilePath>): boolean {
        if (IGNORE_DIRS.includes(dirent.name)) {
            return true;
        }
        if (!dirent.isFile() && !dirent.isDirectory()) {
            return true;
        }
        if (dirent.isFile() && !configFiles.has(filePath) && !this.isSpecificationFile(filePath)) {
            return true;
        }
        return false;
    }

    private calculateItemSelected(
        workfolderPath: WorkfolderPath,
        path: FilePath,
        localFiles: Set<FilePath>,
        configFiles: Set<FilePath>,
        configFileExist: boolean
    ): boolean {
        if (this.itemCheckboxService.has(workfolderPath, path)) {
            return true;
        }
        if (localFiles.has(path)) {
            return false;
        }
        const selected = configFileExist ? configFiles.has(path) : true;
        if (selected) {
            this.itemCheckboxService.add(workfolderPath, path);
        }
        return selected;
    }

    private sortSpecificationItems(specItems: SpecificationItem[]): SpecificationItem[] {
        return specItems.sort((firstValue, secondValue) => {
            const descriptionComparison = firstValue.description.localeCompare(secondValue.description);
            return descriptionComparison !== 0
                ? descriptionComparison
                : firstValue.label.localeCompare(secondValue.label);
        });
    }

    private isSpecificationFile(filePath: FilePath): boolean {
        const extension = getExtension(filePath);
        if (!extension) {
            return false;
        }
        if (SPECS_ADDITIONAL_EXTENSIONS.includes(extension)) {
            return true;
        }
        if (isApiSpecFile(extension)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return OPENAPI_SPEC_KEY_REGEXP.test(fileContent);
        }
        return false;
    }

    private subscribeChanges(): void {
        this._watcher.onDidChange(this.refresh.bind(this), this, this._disposables);
        this._watcher.onDidCreate(this.refresh.bind(this), this, this._disposables);
        this._watcher.onDidDelete(this.handleFileDeletion.bind(this), this, this._disposables);

        this.configurationFileService.subscribe(SPECIFICATION_TREE, (workspacePath: WorkfolderPath) => {
            this.setFilesFromConfig(workspacePath);
            if (this.workspaceFolderService.activeWorkfolderPath === workspacePath) {
                this.refresh();
            }
        });

        this.workspaceFolderService.subscribe(SPECIFICATION_TREE, this.refresh.bind(this));
    }

    private handleFileDeletion(deletedFile: Uri): void {
        const filePath = deletedFile.fsPath;
        this.itemCheckboxService.deleteAll(filePath);

        const { localFiles } = this.getSpecificationFileData(this.workspaceFolderService.activeWorkfolderPath);
        localFiles.delete(filePath);

        this.refresh();
    }

    private setFilesFromConfig(workfolderPath: WorkfolderPath): void {
        const configurationFileData = this.configurationFileService.getConfigurationFile(workfolderPath);
        const specificationTreeData = this.getSpecificationFileData(workfolderPath);

        if (!configurationFileData || configurationFileData.id === specificationTreeData.configId) {
            return;
        }

        specificationTreeData.configId = configurationFileData.id;
        this.itemCheckboxService.clear(workfolderPath);

        const { configFiles } = specificationTreeData;
        configFiles.clear();

        configurationFileData.files.forEach((filePath) => {
            const fullFilePath = path.join(workfolderPath, filePath);
            this.itemCheckboxService.add(workfolderPath, fullFilePath);
            configFiles.add(fullFilePath);
        });
    }

    private getSpecificationFileData(workfolderPath: WorkfolderPath): SpecificationTreeData {
        if (!this._specificationFileData.has(workfolderPath)) {
            this._specificationFileData.set(workfolderPath, new SpecificationTreeData());
        }
        return this._specificationFileData.get(workfolderPath)!;
    }
}
