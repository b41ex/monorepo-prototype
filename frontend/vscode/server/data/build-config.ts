import { BuildConfig, VersionStatus } from '../../src/common/models/publishing.model';
import { PACKAGE_ID_NAME, PACKAGE_ID_RELEASE_NAME } from './packages';
import { VERSION_2, VERSION_3 } from './versions';

export const BUILD_CONFIGS: BuildConfig[] = [
    {
        packageId: PACKAGE_ID_NAME,
        status: VersionStatus.DRAFT,
        version: VERSION_3,
        previousVersion: VERSION_2,
        files: [
            {
                fileId: 'src/docs/pets.yaml',
                publish: true
            },
            {
                fileId: 'src/docs/Pet/Operations/updatePet.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Models/Pet.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Models/Category.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Models/Tag.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Operations/findPetsByStatus.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Operations/findPetsByTags.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Operations/getPetById.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Operations/uploadFile.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Pet/Models/ApiResponse.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Store/Operations/getInventory.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Store/Operations/placeOrder.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/store.yaml',
                publish: true
            },
            {
                fileId: 'src/docs/Store/Models/Order.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Store/Operations/getOrderById.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/User/Operations/createUser.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/user.yaml',
                publish: true
            },
            {
                fileId: 'src/docs/User/Models/User.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/User/Operations/createUsersWithListInput.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/User/Operations/loginUser.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/User/Operations/logoutUser.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/User/Operations/getUserByName.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/testGql.gql',
                publish: true
            },
            {
                fileId: 'src/docs/testGraphql.graphql',
                publish: true
            },
            {
                fileId: 'src/docs/gql/testGql.gql',
                publish: true
            }
        ],
        metadata: {
            versionLabels: ['Publish-test']
        }
    },
    {
        packageId: PACKAGE_ID_RELEASE_NAME,
        status: VersionStatus.RELEASE,
        version: VERSION_3,
        previousVersion: '',
        files: [
            { fileId: 'src/docs/store.yaml', publish: true },
            {
                fileId: 'src/docs/Store/Operations/getInventory.yaml',
                publish: false
            },
            {
                fileId: 'src/docs/Store/Operations/placeOrder.yaml',
                publish: false
            },
            { fileId: 'src/docs/Store/Models/Order.yaml', publish: false },
            {
                fileId: 'src/docs/Store/Operations/getOrderById.yaml',
                publish: false
            }
        ],
        metadata: { versionLabels: ['Publish-release-test'] }
    }
];
