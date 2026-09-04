# APIHUB UI — nginx serving the two built front ends.
#
# Build context is the WORKSPACE ROOT, not this directory:
#   docker build -f frontend/ui/Dockerfile .
#
# What changed in the monorepo, and why it matters beyond tidiness (§6):
#
#   Before: a `node:24` builder stage ran `npm pack @b41ex/…-ui-agents@$TAG` and
#           `…-ui-portal@$TAG` against the registry, behind an `npmrc` build secret, then
#           untarred the result. The image could only ever be as good as the last publish,
#           and the "publish, then pull what you just published" round trip is precisely the
#           cross-repo version skew the monorepo exists to remove.
#
#   Now:    the two dist trees are COPYed straight from the workspace build. There is no
#           builder stage, no registry access, and no NPMRC secret — with nothing pulled at
#           image-build time there is nothing to authenticate.
#
# The image therefore contains exactly what CI just built and tested, at this commit.

FROM docker.io/nginx:1.31.3-alpine3.24

ARG GIT_BRANCH=unknown
ARG GIT_HASH=unknown
ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_HASH=$GIT_HASH

COPY frontend/ui/nginx/errors              /var/www/error
COPY frontend/ui/nginx/nginx.conf.template /app/nginx.conf.template
COPY frontend/ui/nginx/entrypoint.sh       /app/entrypoint.sh

# `ui-agents` is built with base '/agents/' and `ui-portal` with '/', which is why they land
# in sibling directories rather than one tree.
COPY frontend/ui/packages/agents/dist/ /usr/share/nginx/html/agents/
COPY frontend/ui/packages/portal/dist/ /usr/share/nginx/html/portal/

# Sets the correct file creation time.
# https://github.com/Netcracker/qubership-apihub/issues/238#issuecomment-3019713963
RUN find /usr/share/nginx/html -type f -exec touch {} +

RUN mkdir -p /app/nginx && \
    chmod -R 777 /var/log/nginx /var/cache/nginx/ /var/run/ /usr/share/nginx/html/ /app/nginx && \
    chmod -R +x /app/

WORKDIR /app

EXPOSE 8080

USER 1000

ENTRYPOINT ["/app/entrypoint.sh"]
