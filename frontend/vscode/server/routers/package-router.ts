import { Router } from 'express';
import {
    BuildConfig,
    PublishingConfig,
    PublishingStatus,
    PublishingStatusDto,
    PublishingVersion,
    PublishingVersionDto,
    PublishingViewPackageIdData
} from '../../src/common/models/publishing.model';
import { PACKAGE_ID_NAME, PACKAGE_ID_RELEASE_NAME, PACKAGE_ID_VERSIONS_NAME, PACKAGES_DATA } from '../data/packages';
import { RELEASE_VERSIONS, VERSIONS } from '../data/versions';
import multer from 'multer';
import { BUILD_CONFIGS } from '../data/build-config';
import { PUBLISH_ID } from '../data/publish';
import { deepEqualIgnoreOrder as deepEqualBuildConfig } from '../utils/build.utils';

const upload = multer();
export type PackageRouter = Router;

export function PackageRouter(): PackageRouter {
    const router = Router();

    getVersions(router);
    getPackageIdData(router);
    postPublish(router);
    getPublishStatus(router);

    return router;
}

const VERSIONS_BY_PACKAGE: Record<string, PublishingVersion[]> = {
    [PACKAGE_ID_NAME]: VERSIONS,
    [PACKAGE_ID_VERSIONS_NAME]: VERSIONS,
    [PACKAGE_ID_RELEASE_NAME]: RELEASE_VERSIONS
};

export function getVersions(router: PackageRouter): void {
    router.get('/:packageId/versions/', (req, res) => {
        const packageId = req.params.packageId;
        res.status(200).json({ versions: VERSIONS_BY_PACKAGE[packageId] ?? [] } as PublishingVersionDto);
    });
}

export function getPackageIdData(router: PackageRouter): void {
    router.get('/:packageId/', (req, res) => {
        const packageId = req.params.packageId;
        const packageIdData: PublishingViewPackageIdData | undefined = PACKAGES_DATA.find(
            (data) => data.packageId === packageId
        );
        if (packageIdData) {
            res.status(200).json(packageIdData as PublishingViewPackageIdData);
            return;
        }
        res.status(404).json();
    });
}

export function postPublish(router: PackageRouter): void {
    router.post('/:packageId/publish/', upload.any(), (req, res) => {
        const packageId = req.params.packageId;
        const buildConfig: BuildConfig | undefined = BUILD_CONFIGS.find((config) => config.packageId === packageId);
        const body = JSON.parse(req.body.config);
        if (deepEqualBuildConfig(buildConfig, body)) {
            setTimeout(
                () => res.status(200).json({ config: buildConfig, publishId: PUBLISH_ID } as PublishingConfig),
                500
            );
        } else {
            setTimeout(() => res.status(500).json(), 500);
        }
    });
}

export function getPublishStatus(router: PackageRouter): void {
    router.get('/:packageId/publish/:publishId/status/', (req, res) => {
        const publishId = req.params.publishId;
        if (publishId === PUBLISH_ID) {
            setTimeout(
                () =>
                    res
                        .status(200)
                        .json({ message: '', publishId: '', status: PublishingStatus.COMPLETE } as PublishingStatusDto),
                500
            );
        } else {
            setTimeout(() => res.status(500).json(), 500);
        }
    });
}
