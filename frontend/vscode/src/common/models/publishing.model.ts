import { PUBLISHING_INPUT_DEFAULT_PATTERN, PUBLISHING_NO_PREVIOUS_VERSION } from '../constants/publishing.constants';
import { ConfigurationId } from './configuration.model';
import { WebviewMessage, WebviewMessages, WebviewPayload } from './webview.model';

export type PackageId = string;
export type VersionId = string | `${string}@${number}`;
export type FileId = string;
export type PublishingWebviewValueType = string | string[];

export enum VersionStatus {
    RELEASE = 'release',
    DRAFT = 'draft',
    ARCHIVED = 'archived'
}

export interface BuildConfigFile {
    fileId: FileId;
    publish: boolean;
}
export interface BuildConfigMetadata {
    versionLabels: string[];
}

export interface BuildConfig {
    packageId: PackageId;
    version: VersionId;
    status: VersionStatus;
    previousVersion: VersionId;
    files: BuildConfigFile[];
    metadata: BuildConfigMetadata | {};
}

export type Key = Readonly<string>;
export type PublishingConfig = { publishId: Key; config: BuildConfig };

export type PublishingStatusDto = {
    publishId: string;
    status: PublishingStatus;
    message: string;
};

export enum PublishingStatus {
    NONE = 'none',
    RUNNING = 'running',
    COMPLETE = 'complete',
    ERROR = 'error'
}

export enum PublishingWebviewMessages {
    PUBLISH = 'publish'
}

export enum PublishingFields {
    PACKAGE_ID = 'packageId',
    VERSION = 'version',
    STATUS = 'status',
    PREVIOUS_VERSION = 'previousVersion',
    PREVIOUS_VERSION_LABEL = 'previousVersionLabel',
    PREVIOUS_VERSION_GROUP = 'previousVersionGroup',
    LABELS = 'labels',
    PUBLISHING_BUTTON = 'publishing-button'
}

export interface PublishingVersionCreatedBy {
    avatarUrl: string;
    email: string;
    id: string;
    name: string;
    type: string;
}
export interface PublishingVersion {
    version: string;
    status: string;
    createdAt: string;
    createdBy: PublishingVersionCreatedBy;
    versionLabels: string[];
    previousVersion: string;
}
export interface PublishingVersionDto {
    versions: PublishingVersion[];
}

export interface PublishingWebviewDto
    extends WebviewMessage<WebviewMessages | PublishingWebviewMessages, WebviewPayload<PublishingFields> | void> {}

export class PublishingViewData {
    public packageId: PackageId;
    public version: VersionId;
    public labels: Set<string>;
    public status: VersionStatus;
    public previousVersion: VersionId;
    public configId: ConfigurationId;
    public releaseVersionPattern: string;

    constructor() {
        this.packageId = '';
        this.version = '';
        this.labels = new Set();
        this.status = VersionStatus.DRAFT;
        this.previousVersion = PUBLISHING_NO_PREVIOUS_VERSION;
        this.configId = '';
        this.releaseVersionPattern = PUBLISHING_INPUT_DEFAULT_PATTERN;
    }
}

export interface PublishingViewPackageIdData {
    packageId: PackageId;
    alias: string;
    parentId: string;
    kind: string;
    name: string;
    description: string;
    isFavorite: boolean;
    imageUrl: string;
    parents: string[];
    defaultRole: string;
    permissions: string[];
    defaultReleaseVersion: string;
    defaultVersion: string;
    releaseVersionPattern: string;
    excludeFromSearch: boolean;
}
