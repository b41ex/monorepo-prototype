# APIHUB build-task-consumer — a NestJS service.
#
# Build context is the WORKSPACE ROOT, and the image expects a `pnpm deploy` tree to have
# been produced there first:
#
#   pnpm deploy --filter=build-task-consumer --prod .deploy/build-task-consumer
#   docker build -f frontend/build-task-consumer/Dockerfile .
#
# `pnpm deploy` materialises a self-contained, hoisted node_modules plus the package's own
# files — production dependencies only, workspace: specs already resolved to the real trees.
# That is exactly what a container needs and it is produced on the host, where the CPU is.
#
# Why this had to be rewritten rather than ported (§6, and it is the sharpest example):
#
#   Before: `npm pack @b41ex/…@$TAG` from the registry, then `npm ci --omit=dev` INSIDE the
#           image against the packed `npm-shrinkwrap.json`. It is the only image that ran an
#           install inside itself, and it lacked `--platform=$BUILDPLATFORM` on its build
#           stage — so the arm64 variant did a full cold npm install under QEMU emulation,
#           with `no-cache: true` on top. **15.7 minutes**, the slowest image by a factor of
#           three, and the reason "seven images is too slow" looked like a fan-out problem
#           when it was one Dockerfile.
#
#   And:    the workspace wiring DELETED npm-shrinkwrap.json along with the 17 per-component
#           lock files, so the old Dockerfile does not merely round-trip through the registry
#           — it references a file that no longer exists. It was already broken.
#
#   Now:    no install, no registry, no shrinkwrap, no QEMU install. A COPY of two trees.

FROM docker.io/node:24-alpine

ARG GIT_BRANCH=unknown
ARG GIT_HASH=unknown
ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_HASH=$GIT_HASH
ENV NODE_ENV=production

WORKDIR /usr/src/app

# The deploy tree carries package.json and a production-only node_modules.
COPY .deploy/build-task-consumer/package.json  ./package.json
COPY .deploy/build-task-consumer/node_modules  ./node_modules

# The build output, straight from the workspace build.
COPY frontend/build-task-consumer/dist ./dist

# npm and its friends are not needed at runtime and are a needless attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

USER 10001

CMD ["node", "--max-old-space-size=3100", "--max-semi-space-size=32", "dist/main"]
