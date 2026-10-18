# PocketBase versionné : migrations et hooks du repo embarqués dans l'image.
FROM alpine:3.22
ARG PB_VERSION=0.40.5
ARG TARGETARCH=amd64
ARG PB_SHA256_amd64=1dbea1b01eb3dfe64953513859d01e759c96650c4e3264fa4eecd54b769382e4
ARG PB_SHA256_arm64=570baa1c45d2fb92fc0073582b945ca0ece03cbf9837ccabf49a222f99dd02e3

RUN apk add --no-cache ca-certificates unzip wget \
 && addgroup -S pb && adduser -S -G pb -h /pb pb

RUN set -eux; \
    wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip"; \
    if [ "$TARGETARCH" = "arm64" ]; then SUM="$PB_SHA256_arm64"; else SUM="$PB_SHA256_amd64"; fi; \
    echo "${SUM}  /tmp/pb.zip" | sha256sum -c -; \
    unzip -q /tmp/pb.zip pocketbase -d /usr/local/bin; rm /tmp/pb.zip; \
    mkdir -p /pb/pb_data && chown -R pb:pb /pb

COPY --chown=pb:pb pb_migrations /pb/pb_migrations
COPY --chown=pb:pb pb_hooks /pb/pb_hooks

USER pb
WORKDIR /pb
EXPOSE 8090
VOLUME /pb/pb_data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
