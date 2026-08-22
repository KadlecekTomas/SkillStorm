FROM postgres:15-alpine

RUN apk add --no-cache \
      bash \
      coreutils \
      curl \
      findutils \
      nodejs \
      perl \
  && curl --help all | grep -q -- '--aws-sigv4'

WORKDIR /app
COPY scripts/ops /app/scripts/ops
RUN chmod 0555 /app/scripts/ops/*.sh

ENTRYPOINT ["/app/scripts/ops/backup-production.sh"]
