import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';
import { API_V1, API_V2, API_V3, PACKAGES } from '../src/common/constants/common.constants';
import { SystemRouter } from './routers/system-router';
import { PackageRouter } from './routers/package-router';

const app = express();
const port = process.env.NODEJS_PORT || 3003;
const server = http.createServer(app);

const routersMap = new Map([
    [`${API_V1}/system/`, SystemRouter()],
    [`${API_V2}/${PACKAGES}/`, PackageRouter()],
    [`${API_V3}/${PACKAGES}/`, PackageRouter()],
]);

app.use(bodyParser.json());
app.use(bodyParser.text());

routersMap.forEach((router, path) => app.use(path, router));

server.listen(port, () => console.log(`Mock server is listening on port ${port}`));
