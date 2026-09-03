import { bundle, BundleContext, Resolver } from 'api-ref-bundler';
import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';
import { BundleData } from '../common/models/bundle.model';
import { BuildConfigFile } from '../common/models/publishing.model';
import { SpecificationItem } from '../common/models/specification-item';
import { getFileDirectory, getFilePath } from './path.utils';

export const bundledFileDataWithDependencies = async (
    item: SpecificationItem,
    onError: (message: string, ctx?: BundleContext) => void
): Promise<BundleData> => {
    const files: File[] = [];
    const dependencies: string[] = [];
    const errorMessages: string[] = [];

    const workspacePath = item.workspacePath;
    const rootApiSpecPath = item.uri.fsPath;
    const rootApiSpecName = getFilePath(workspacePath, rootApiSpecPath);
    const rootApiSpecDirectory = getFileDirectory(rootApiSpecPath);

    const resolver: Resolver = async (sourcePath: string): Promise<object> => {
        try {
            let normalizedPath = sourcePath;

            if (sourcePath !== rootApiSpecPath) {
                if (!path.isAbsolute(sourcePath)) {
                    normalizedPath = path.join(rootApiSpecDirectory, sourcePath);
                }
                dependencies.push(normalizedPath);
            }

            const apispecName = getFilePath(workspacePath, normalizedPath);
            const apispecData = await fs.readFile(normalizedPath, 'utf8');
            const apispecFile = new File([apispecData], apispecName);
            files.push(apispecFile);

            return YAML.parse(apispecData) as object;
        } catch (error) {
            errorMessages.push(`Error resolving path ${sourcePath}: ${error}`);
            return {};
        }
    };

    const bundledFileData = await bundle(rootApiSpecPath, resolver, { hooks: { onError } });
    const data = bundledFileData && Object.keys(bundledFileData).length ? bundledFileData : undefined;

    if (!data && errorMessages.length) {
        onError(errorMessages.join('\n'));
    }

    return { fileName: rootApiSpecName, filePath: rootApiSpecPath, data, dependencies, files };
};

export const createBuildConfigFiles = (publishingFileNames: string[], allFileNames: string[]): BuildConfigFile[] => {
    if (!publishingFileNames?.length) {
        return [];
    }
    return allFileNames.map((fileName) => ({ fileId: fileName, publish: publishingFileNames.includes(fileName) }));
};

export const convertBundleDataToFiles = (bundleData: BundleData[]): File[] => {
    const fileMap = new Map<string, File>();
    bundleData.forEach((data) => {
        data.files.forEach((file) => fileMap.set(file.name, file));
    });
    return Array.from(fileMap.values());
};
