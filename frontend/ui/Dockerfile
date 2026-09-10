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

# GIT_BRANCH / GIT_HASH used to be declared here as build args and promoted to ENV. They are
# gone deliberately, and this note is what stops them coming back.
#
# They named the ref and commit that built the image. They were never part of the content
# hash — tools/ci/image-input-hash.sh reads git tree objects and cannot read a build arg — so
# two refs at one commit hashed identically and produced two DIFFERENT images competing for a
# single src-<hash> tag. Worse, on the retag path nothing is rebuilt, so a branch tag was
# published pointing at an image whose ENV named whichever ref built the content first.
# Measured on 2026-09-10: the image serving :dev reported GIT_BRANCH=main.
#
# The provenance is now attached where it is actually true: as OCI annotations on the index
# that ci.yml creates for each branch tag. Read it with
#
#   docker buildx imagetools inspect ghcr.io/b41ex/<image>:<tag>
#
# and it answers for the tag you pulled rather than for the ref that happened to build first.

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
