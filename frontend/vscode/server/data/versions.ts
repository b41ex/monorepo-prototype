import { PublishingVersion } from '../../src/common/models/publishing.model';

export const VERSION_LABEL = 'DRAFT';
export const VERSION_1 = "2025.1";
export const VERSION_2 = "2025.2";
export const VERSION_3 = "2025.3";

export const VERSIONS: PublishingVersion[] = [
    {
        version: `${VERSION_2}@1`,
        status: 'draft',
        createdAt: '2025-03-11T10:49:08.291543Z',
        createdBy: {
            avatarUrl: '',
            email: 'userEmail',
            id: 'userId',
            name: 'userName',
            type: 'user'
        },
        versionLabels: [VERSION_LABEL],
        previousVersion: `${VERSION_1}@1`
    },
    {
        version: `${VERSION_1}@1`,
        status: 'release',
        createdAt: '2025-03-11T10:38:41.00982Z',
        createdBy: {
            avatarUrl: '',
            email: 'userEmail',
            id: 'userId',
            name: 'userName',
            type: 'user'
        },
        versionLabels: [],
        previousVersion: ''
    }
];

export const RELEASE_VERSIONS: PublishingVersion[] = [
    {
        version: `${VERSION_1}@1`,
        status: 'release',
        createdAt: '2025-03-11T10:38:41.00982Z',
        createdBy: {
            avatarUrl: '',
            email: 'userEmail',
            id: 'userId',
            name: 'userName',
            type: 'user'
        },
        versionLabels: [],
        previousVersion: ''
    }
];
