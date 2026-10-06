FROM eclipse-temurin:17-jdk-jammy
RUN apt-get update && apt-get install -y --no-install-recommends python3 curl unzip xz-utils git ca-certificates libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/mobile ./apps/mobile
COPY infra/deployment/mobile ./infra/deployment/mobile
ARG RAILWAY_GIT_COMMIT_SHA
ENV MASANAWA_APK_SOURCE_COMMIT=${RAILWAY_GIT_COMMIT_SHA}
ENV PORT=8080
EXPOSE 8080
CMD ["bash", "infra/deployment/mobile/start-builder.sh"]
