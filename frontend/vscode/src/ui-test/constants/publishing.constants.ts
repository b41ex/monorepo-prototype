import { PUBLISHING_BUTTON_LINK_MESSAGE, PUBLISHING_SUCCESSFUL_MESSAGE } from '../../common/constants/publishing.constants';
import { EXTENSION_NAME } from './test.constants';

export const PUBLISH_NOTIFICATION_MESSAGE = `Source: ${EXTENSION_NAME}\n${PUBLISHING_BUTTON_LINK_MESSAGE}\n${PUBLISHING_SUCCESSFUL_MESSAGE}`;
export const CONFIG_FILE_1 =
    'packageId: packageId\nfiles:\n  - src/docs/gql/testGql.gql\n  - src/docs/pets.yaml\n  - src/docs/store.yaml\n  - src/docs/testGql.gql\n  - src/docs/testGraphql.graphql\n  - src/docs/user.yaml\nversion: 1\n';
export const CONFIG_FILE_2 =
    'packageId: packageId\nfiles:\n  - src/docs/pets.yaml\n  - src/docs/store.yaml\nversion: 1\n';
export const CONFIG_FILE_3 =
    'packageId: packageId-release\nfiles:\n  - src/docs/store.yaml\nversion: 1\n';
export const CONFIG_FILE_4 =
    'packageId: packageId-release\nfiles:\n\nversion: 1\n';
export const CONFIG_FILE_5 =
    'packageId: packageId-release\nfiles:\n  - src/docs/store.yaml\n  - src/docs/info.docx\nversion: 1\n';
export const CONFIG_FILE_6 =
    'packageId: packageId-release\nfiles:\n  - cars.yaml\nversion: 1\n';
