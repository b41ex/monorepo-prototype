import path from 'path';
import { SPECS_MAIN_EXTENSIONS } from '../common/constants/specification.constants';
import { WorkfolderPath } from '../common/models/common.model';
import { SpecificationItem } from '../common/models/specification-item';
import { workspace } from 'vscode';

export const getFilePath = (workfolderPath: WorkfolderPath, filePath: string): string => {
    return path.posix.normalize(relative(workfolderPath, filePath));
};

const relative = (workfolderPath: WorkfolderPath, filePath: string): string => {
    return path.relative(workfolderPath, filePath).replace(/\\/g, '/');
};

export const getMiddlePath = (workfolderPath: WorkfolderPath, filePath: string): string => {
    const middlePath = path.dirname(relative(workfolderPath, filePath));
    return middlePath === '.' ? '' : `/${middlePath}/`;
};

export const getFileDirectory = (filePath: string): string => {
    return path.dirname(filePath) + path.sep;
};

export const capitalize = (str: string): string => {
    if (!str) {
        return '';
    }
    return str[0].toUpperCase() + str.slice(1);
};

export const getExtension = (fileName: string): string => {
    return fileName.split('.').pop() || '';
};

export const isApiSpecFile = (extension: string): boolean => {
    return SPECS_MAIN_EXTENSIONS.includes(extension);
};

export const isItemApiSpecFile = (item: SpecificationItem): boolean => {
    return isApiSpecFile(getExtension(item.uri.fsPath));
};

export const normalizeUrl = (url: string): string => {
    try {
        return new URL(url).origin;
    } catch {
        return '';
    }
};

export const getWorkspaceFolders = (): WorkfolderPath[] => {
    return workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) || [];
};
