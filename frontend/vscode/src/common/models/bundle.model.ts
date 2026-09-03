export interface BundleData {
    fileName: string;
    filePath: string;
    data?: object;
    dependencies: string[];
    files: File[];
}
