FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssh-client ca-certificates && rm -rf /var/lib/apt/lists/*
COPY scripts/bootstrap-financial-relay.sh /bootstrap-financial-relay.sh
RUN chmod 700 /bootstrap-financial-relay.sh
CMD ["/bootstrap-financial-relay.sh"]
