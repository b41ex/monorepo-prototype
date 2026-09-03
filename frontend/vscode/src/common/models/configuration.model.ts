import { Uri } from 'vscode';

export type ConfigurationId = string;
export interface ConfigurationFile {
    version: number;
    packageId: string;
    files: string[];
}
export interface ConfigurationFileLike {
    id: ConfigurationId;
    version: number;
    packageId: string;
    files: Set<string>;
}
export interface ConfigurationData {
    filePath: Uri;
    config: ConfigurationFileLike;
    parentPath: string;
    configString: string;
}
