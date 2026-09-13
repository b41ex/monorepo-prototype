set GOSUMDB=off
set CGO_ENABLED=0
set GOOS=linux
go mod tidy
go mod download
go build .
podman build ./ -t netcracker/qubership-apihub-test-service