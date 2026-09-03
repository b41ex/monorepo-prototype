import { commands, Disposable, env, Event, EventEmitter, StatusBarAlignment, StatusBarItem, Uri, window } from 'vscode';
import { SpecificationFileTreeProvider } from '../specification-tree/specification-tree-provider';
import {
    bundledFileDataWithDependencies,
    convertBundleDataToFiles,
    createBuildConfigFiles
} from '../../utils/document.utils';
import { convertPreviousVersion, packToZip, specificationItemToFile } from '../../utils/files.utils';
import { getFilePath, isItemApiSpecFile } from '../../utils/path.utils';
import { EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME, PACKAGES } from '../constants/common.constants';
import {
    PUBLISHING_BUTTON_LINK_MESSAGE,
    PUBLISHING_DATA_NAME,
    PUBLISHING_SUCCESSFUL_MESSAGE,
    STATUS_BAR_TEXT,
    STATUS_REFETCH_INTERVAL,
    STATUS_REFETCH_MAX_ATTEMPTS
} from '../constants/publishing.constants';
import { CrudService } from '../cruds/crud.service';
import { WorkfolderPath } from '../models/common.model';
import {
    BuildConfig,
    PackageId,
    PublishingConfig,
    PublishingStatus,
    PublishingStatusDto,
    PublishingViewData,
    VersionId,
    VersionStatus
} from '../models/publishing.model';
import { SpecificationItem } from '../models/specification-item';
import { ConfigurationFileService } from './configuration-file.service';
import { EnvironmentStorageService } from './environment-storage.service';
import { delay } from '../../utils/common.utils';

export class PublishingService extends Disposable {
    private readonly _crudService: CrudService;
    private readonly _statusBarItem: StatusBarItem;
    private _disposables: Disposable[] = [];
    private readonly _onPublish: EventEmitter<boolean> = new EventEmitter();
    public readonly onPublish: Event<boolean> = this._onPublish.event;
    private _isPublishingProgress = false;

    constructor(
        private readonly fileTreeProvider: SpecificationFileTreeProvider,
        private readonly environmentStorageService: EnvironmentStorageService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        super(() => this.dispose());
        this._crudService = new CrudService();
        this._disposables.push(this._crudService);
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        this._statusBarItem.text = STATUS_BAR_TEXT;
    }

    public get isPublishingProgress(): boolean {
        return this._isPublishingProgress;
    }

    public async publish(workfolderPath: WorkfolderPath, data: PublishingViewData): Promise<void> {
        this.startPublishingProgress();

        try {
            const filesToPublish = await this.fileTreeProvider.getFilesForPublishing();
            const { host, token } = await this.environmentStorageService.getEnvironment();

            await this.validateAndPublish(host, token, filesToPublish, data);

            this.updateConfigurationFile(workfolderPath, data.packageId, filesToPublish);
            this.showSuccessMessage(host, data.packageId, data.version);
        } catch (error) {
            this.handlePublishingError(error);
        } finally {
            this.endPublishingProgress();
        }
    }

    public dispose(): void {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
    }

    private startPublishingProgress(): void {
        this._statusBarItem.show();
        this.updatePublishingProgress(true);
    }

    private endPublishingProgress(): void {
        this._statusBarItem.hide();
        this.updatePublishingProgress(false);
    }

    private updatePublishingProgress(value: boolean): void {
        this._isPublishingProgress = value;
        this._onPublish.fire(value);
    }

    private async validateAndPublish(
        host: string,
        authorization: string,
        items: SpecificationItem[],
        publishingData: PublishingViewData
    ): Promise<PublishingStatusDto> {
        this.validateInputs(host, authorization, items, publishingData);

        const { packageId, version, status, previousVersion, labels } = publishingData;

        const apiSpecItems = items.filter(isItemApiSpecFile);
        const additionalItems = items.filter((item) => !isItemApiSpecFile(item));

        const publishingFiles = await this.bundleItems(apiSpecItems);
        publishingFiles.push(...additionalItems.map(specificationItemToFile));

        const zipData = await this.createZip(publishingFiles);

        const publishingFileNames = items.map((item) => getFilePath(item.workspacePath, item.resourceUri?.fsPath ?? ''));
        const additionalFileNames = publishingFiles.map((file) => file.name);

        const publishingConfig = await this.publishApiSpec(
            host,
            publishingFileNames,
            additionalFileNames,
            zipData,
            packageId,
            status,
            version,
            previousVersion,
            Array.from(labels),
            authorization
        );

        return this.getPublishStatus(host, packageId, publishingConfig.publishId, authorization);
    }

    private validateInputs(
        host: string,
        authorization: string,
        items: SpecificationItem[],
        publishingData: PublishingViewData
    ): void {
        if (!host) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            throw new Error('Error: Empty Url');
        }
        if (!authorization) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            throw new Error('Error: Empty Token');
        }
        if (!items?.length) {
            throw new Error('Error: Files not selected for publishing');
        }
        const { packageId, version, status, previousVersion } = publishingData;
        if (!packageId || !version || !status || !previousVersion) {
            throw new Error('Fill all required fields');
        }
    }

    private async bundleItems(items: SpecificationItem[]): Promise<File[]> {
        const bundleErrors: string[] = [];
        const dataWithDependencies = await Promise.all(
            items.map((path) => bundledFileDataWithDependencies(path, (err) => bundleErrors.push(err)))
        );

        if (bundleErrors.length) {
            console.error('Errors: ' + bundleErrors.join(', '));
        }

        return convertBundleDataToFiles(dataWithDependencies);
    }

    private async createZip(files: File[]): Promise<Blob> {
        try {
            return await packToZip(files);
        } catch (error) {
            console.error(error);
            throw new Error('Pack to zip error');
        }
    }

    private async publishApiSpec(
        host: string,
        publishingFileNames: string[],
        allFileNames: string[],
        blobData: Blob,
        packageId: PackageId,
        status: VersionStatus,
        version: VersionId,
        previousVersion: VersionId,
        versionLabels: string[],
        authorization: string
    ): Promise<PublishingConfig> {
        const buildConfig = createBuildConfigFiles(publishingFileNames, allFileNames);
        const normalizedPreviousVersion = convertPreviousVersion(previousVersion);

        const config: BuildConfig = {
            packageId,
            status,
            version,
            previousVersion: normalizedPreviousVersion,
            files: buildConfig,
            metadata: versionLabels?.length ? { versionLabels } : {}
        };

        const formData = new FormData();
        formData.append('sources', blobData, PUBLISHING_DATA_NAME);
        formData.append('config', JSON.stringify({ ...config, sources: undefined }));

        return this._crudService.publishApiSpec(host, packageId, authorization, formData);
    }

    private async getPublishStatus(
        host: string,
        packageId: PackageId,
        publishId: string,
        authorization: string,
        maxAttempts = STATUS_REFETCH_MAX_ATTEMPTS
    ): Promise<PublishingStatusDto> {
        let attempts = 0;
        while (attempts < maxAttempts) {
            const publishingStatus = await this._crudService.getStatus(host, authorization, packageId, publishId);
            if (publishingStatus.status === PublishingStatus.COMPLETE) {
                return publishingStatus;
            }
            if (publishingStatus.status === PublishingStatus.ERROR) {
                throw new Error(publishingStatus.message);
            }
            attempts++;
            await delay(STATUS_REFETCH_INTERVAL);
        }
        throw new Error('Waiting time exceeded');
    }

    private updateConfigurationFile(
        workfolderPath: WorkfolderPath,
        packageId: PackageId,
        files: SpecificationItem[]
    ): void {
        this.configurationFileService.updateConfigurationFile(
            workfolderPath,
            packageId,
            files.map((file) => file.uri.fsPath)
        );
    }

    private showSuccessMessage(host: string, packageId: PackageId, version: VersionId): void {
        window.showInformationMessage(PUBLISHING_SUCCESSFUL_MESSAGE, PUBLISHING_BUTTON_LINK_MESSAGE).then((selection) => {
            if (selection === PUBLISHING_BUTTON_LINK_MESSAGE) {
                env.openExternal(Uri.parse(`${host}/portal/${PACKAGES}/${packageId}/${version}/`));
            }
        });
    }

    private handlePublishingError(error: unknown): void {
        const errorMessage = (error as Error)?.message || 'An unknown error occurred';
        console.error(errorMessage, (error as Error)?.stack);
        window.showErrorMessage(errorMessage);
    }
}
