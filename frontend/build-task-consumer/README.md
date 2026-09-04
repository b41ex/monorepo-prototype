# qubership-apihub-build-task-consumer

Node.js microservice for APIHUB Package versions builds.

This microservice is REST API and task management wrapper for [qubership-apihub-api-processor](https://github.com/Netcracker/qubership-apihub-api-processor) library.

Delievered as a Docker image and included into Qubership-APIHUB delivery as a mandatory part.

So please refer to [qubership-apihub](https://github.com/Netcracker/qubership-apihub) application repository for end-to-end installation details.

## Installation

```bash
npm install
```

## Building the app locally

No `.npmrc` and no GitHub PAT are needed any more. Nothing is fetched from a registry at
image-build time; the image is assembled from output you have already built.

```bash
pnpm install                                    # once, at the workspace root
pnpm exec nx build build-task-consumer
pnpm deploy --filter=./frontend/build-task-consumer --prod \
            frontend/build-task-consumer/.deploy
cd frontend/build-task-consumer && podman build -f Dockerfile.local .
```

The `pnpm deploy` step is the one prerequisite and it cannot be dropped. This image used to
run `npm ci` inside itself against a per-component `npm-shrinkwrap.json`; the workspace has
one lockfile at the root, that shrinkwrap is gone, and the internal dependencies are
`workspace:` specifiers that no in-image install can resolve. `pnpm deploy --prod` produces a
production-only tree with those specifiers already resolved, and it has to run where the
workspace is. See the header of `Dockerfile.local` for why it is not simply moved inside the
image — briefly: it would restore the QEMU-emulated install that made this the slowest image
by a factor of three.

**On Windows** `pnpm deploy` may fail with `EPERM` renaming its temporary directory into
place — a handle held over the thousands of files just written, usually a virus scanner. It is
reliable on Linux. Build this image in CI or WSL if that happens.

### Production Docker image (locally)

The production `Dockerfile` takes the **workspace root** as its context and needs no build
secret, because it pulls nothing from a registry:

```bash
pnpm exec nx build build-task-consumer
pnpm deploy --filter=./frontend/build-task-consumer --prod .deploy/build-task-consumer
podman build -f frontend/build-task-consumer/Dockerfile .     # from the workspace root
```

That is the command CI runs. `Dockerfile.local` exists because the same build from this
directory is shorter and has no workspace-root paths in it; the two differ only in where the
inputs come from.

## Running the app

```bash
# development
$ npm start

# watch mode
$ npm start:dev

# production mode
$ npm start:prod
```
