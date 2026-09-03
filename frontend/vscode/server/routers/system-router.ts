import { Router } from 'express';
import { PAT_HEADER } from '../../src/common/constants/common.constants';
import { TEST_BROKEN_PAT_TOKEN, TEST_LOADING_PAT_TOKEN } from '../../src/ui-test/constants/environment.constants';
import { SERVER_STATUS_DTO } from '../data/status';

export type SystemRouter = Router;

export function SystemRouter(): SystemRouter {
    const router = Router();

    getInfo(router);

    return router;
}
export function getInfo(router: SystemRouter): void {
    router.get('/info', (req, res) => {
        const token: string | undefined = req.get(PAT_HEADER.toLocaleLowerCase());

        if (token === TEST_LOADING_PAT_TOKEN) {
            setTimeout(() => res.status(200).json(SERVER_STATUS_DTO), 1000);
            return;
        }

        if (token === TEST_BROKEN_PAT_TOKEN) {
            res.status(401).json();
            return;
        }

        setTimeout(() => res.status(200).json(SERVER_STATUS_DTO), token === TEST_LOADING_PAT_TOKEN ? 1000 : 100);
    });
}
