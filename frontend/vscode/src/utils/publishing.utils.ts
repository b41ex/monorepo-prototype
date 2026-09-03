import { VersionStatus } from '../common/models/publishing.model';
import { WebviewOption } from '../common/models/webview.model';

export const getPreviousVersionStatuses = (status: VersionStatus): VersionStatus[] => {
    switch (status) {
        case VersionStatus.DRAFT:
            return [VersionStatus.RELEASE, VersionStatus.DRAFT];
        case VersionStatus.RELEASE:
        case VersionStatus.ARCHIVED:
            return [VersionStatus.RELEASE];
        default:
            return assertUnreachableStatus(status);
    }
};

export const hasSamePreviousVersionScope = (one: VersionStatus, another: VersionStatus): boolean => {
    const oneStatuses = getPreviousVersionStatuses(one);
    const anotherStatuses = getPreviousVersionStatuses(another);
    return (
        oneStatuses.length === anotherStatuses.length &&
        oneStatuses.every((status) => anotherStatuses.includes(status))
    );
};

const assertUnreachableStatus = (status: never): never => {
    throw new Error(`Unhandled version status: ${status}`);
};

export const convertOptionsToDto = (
    options: string[],
    selected: string,
    labels?: Record<string, string>
): WebviewOption[] => {
    return (
        options.map((option) => {
            const label = labels?.[option];
            return {
                name: option,
                disabled: false,
                selected: selected ? option === selected : false,
                ...(label ? { label } : {})
            };
        }) ?? []
    );
};
