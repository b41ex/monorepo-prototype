import { PublishingViewPackageIdData } from "../../src/common/models/publishing.model";
import { VERSION_1, VERSION_2 } from "./versions";


export const PACKAGE_ID_NAME = 'packageId';
export const PACKAGE_ID_RELEASE_NAME = 'packageId-release';
export const PACKAGE_ID_VERSIONS_NAME = 'packageId-version';
export const RELEASE_VERSION_PATTERN = '^[0-9]{4}[.]{1}[1-4]{1}$';

export const PACKAGES_DATA: PublishingViewPackageIdData[] = [
    {
        alias: "id",
        defaultReleaseVersion: '',
        defaultRole: 'viewer',
        defaultVersion: '',
        description: '',
        excludeFromSearch: false,
        imageUrl: '',
        isFavorite: false,
        kind: 'package',
        name: 'packageIdFullName',
        packageId: PACKAGE_ID_NAME,
        parentId: '1',
        parents: [],
        permissions: [
            'read'
        ],
        releaseVersionPattern: RELEASE_VERSION_PATTERN
    },
    {
        alias: "id",
        defaultReleaseVersion: '',
        defaultRole: 'viewer',
        defaultVersion: VERSION_1,
        description: '',
        excludeFromSearch: false,
        imageUrl: '',
        isFavorite: false,
        kind: 'package',
        name: 'packageIdFullName',
        packageId: PACKAGE_ID_VERSIONS_NAME,
        parentId: '1',
        parents: [],
        permissions: [
            'read'
        ],
        releaseVersionPattern: RELEASE_VERSION_PATTERN
    },
    {
        alias: "id",
        defaultReleaseVersion: '',
        defaultRole: 'viewer',
        defaultVersion: VERSION_2,
        description: '',
        excludeFromSearch: false,
        imageUrl: '',
        isFavorite: false,
        kind: 'package',
        name: 'packageIdFullName',
        packageId: PACKAGE_ID_RELEASE_NAME,
        parentId: '1',
        parents: [],
        permissions: [
            'read'
        ],
        releaseVersionPattern: RELEASE_VERSION_PATTERN
    }
];
