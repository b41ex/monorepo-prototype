import { BuildConfig } from "../../src/common/models/publishing.model";

export function deepEqualIgnoreOrder(a: BuildConfig | undefined, b: BuildConfig | undefined): boolean {
    if(!a || !b){
        return false;
    }
    const sortedFilesA = [...a.files].sort((x, y) => x.fileId.localeCompare(y.fileId));
    const sortedFilesB = [...b.files].sort((x, y) => x.fileId.localeCompare(y.fileId));

    return JSON.stringify(sortedFilesA) === JSON.stringify(sortedFilesB);
}