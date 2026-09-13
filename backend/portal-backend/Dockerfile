# Note: this uses host platform for the build, and we ask go build to target the needed platform, so we do not spend time on qemu emulation when running "go build"
FROM --platform=$BUILDPLATFORM docker.io/golang:1.26.5-alpine3.23 AS builder
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /workspace

# commons-go beside the component: portal-backend's go.mod carries
# `replace github.com/Netcracker/qubership-apihub-commons-go => ../commons-go`, which from
# the component directory below resolves to /workspace/commons-go. That is why this image
# builds from backend/ rather than from its own component directory.
COPY commons-go ./commons-go
COPY portal-backend ./portal-backend

WORKDIR /workspace/portal-backend

# GOWORK=off: the image builds this module alone. Its go.mod states the versions the workspace
# resolved (`go work sync`), so this is the same code CI tested, and no go.work reaches the
# context to make it otherwise.
RUN GOWORK=off GOSUMDB=off CGO_ENABLED=0 GOFLAGS=-mod=readonly go mod download && GOWORK=off GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build .

FROM ghcr.io/netcracker/qubership-core-base:2.3.7@sha256:b917b3a1731a2ae26b507d22565f030ec25ff8d28b75a80b8b08bbc946f4d73b

ARG GIT_BRANCH=unknown
ARG GIT_HASH=unknown

ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_HASH=$GIT_HASH

WORKDIR /app/qubership-apihub-service

COPY --chown=10001:0 --chmod=555 --from=builder /workspace/portal-backend/qubership-apihub-service ./qubership-apihub-service
COPY --chown=10001:0 --chmod=555 portal-backend/static ./static
COPY --chown=10001:0 --chmod=555 portal-backend/resources ./resources
COPY --chown=10001:0 --chmod=555 portal-backend/docs/api ./api

USER 10001:10001

CMD ["./qubership-apihub-service"]

