# Copyright 2024-2025 NetCracker Technology Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Note: this uses host platform for the build, and we ask go build to target the needed platform, so we do not spend time on qemu emulation when running "go build"
FROM --platform=$BUILDPLATFORM docker.io/golang:1.26.5-alpine3.23 AS builder
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /workspace/qubership-apihub-agent

# The module is the component root, so the context is the module. .dockerignore narrows it to
# go.mod, go.sum and the Go sources.
COPY . .

# GOWORK=off: the image builds this module alone. Its go.mod states the versions the workspace
# resolved (`go work sync`), so this is the same code CI tested, and no go.work ever reaches
# the context to make it otherwise.
RUN GOWORK=off GOSUMDB=off CGO_ENABLED=0 GOFLAGS=-mod=readonly go mod download && GOWORK=off GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build .

FROM ghcr.io/netcracker/qubership-core-base:2.3.7@sha256:b917b3a1731a2ae26b507d22565f030ec25ff8d28b75a80b8b08bbc946f4d73b

ARG GIT_BRANCH=unknown
ARG GIT_HASH=unknown

ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_HASH=$GIT_HASH

WORKDIR /app/qubership-apihub-agent

COPY --chown=10001:0 --chmod=555 --from=builder /workspace/qubership-apihub-agent/qubership-apihub-agent ./qubership-apihub-agent

USER 10001:10001

CMD ["./qubership-apihub-agent"]

