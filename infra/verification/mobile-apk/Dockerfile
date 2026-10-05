FROM ghcr.io/cirruslabs/flutter:stable AS build

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY apps/mobile ./apps/mobile

ARG API_BASE_URL=https://masanawa-gateway-production.up.railway.app
ARG AGENT_BASE_URL=https://masanawa-gateway-production.up.railway.app

# Independent, non-charge production Gateway smoke. Protected routes must exist
# (401/403 are acceptable); a 404 means the deployed composition is incomplete.
RUN set -eux; \
    base="$API_BASE_URL"; \
    curl -fsS "$base/readyz" | tee /tmp/readyz.json; \
    curl -fsS "$base/auth/capabilities" | tee /tmp/auth-capabilities.json; \
    for path in \
      /agent/directory \
      /creator/onboarding \
      /offers \
      /v1/financial/capabilities \
      /v1/financial/crypto/routes; do \
        code="$(curl -sS -o /tmp/route-body -w '%{http_code}' "$base$path")"; \
        echo "$path -> $code"; \
        test "$code" != "000"; \
        test "$code" != "404"; \
    done

WORKDIR /workspace/apps/mobile
RUN flutter --version
RUN flutter pub get
RUN flutter analyze
RUN flutter test
RUN flutter build apk --release \
    --dart-define=API_BASE_URL=$API_BASE_URL \
    --dart-define=AGENT_BASE_URL=$AGENT_BASE_URL
RUN test -s build/app/outputs/flutter-apk/app-release.apk \
    && sha256sum build/app/outputs/flutter-apk/app-release.apk | tee /tmp/apk-sha256.txt

FROM nginx:alpine
COPY --from=build /workspace/apps/mobile/build/app/outputs/flutter-apk/app-release.apk /usr/share/nginx/html/masanawa-production.apk
COPY --from=build /tmp/apk-sha256.txt /usr/share/nginx/html/masanawa-production.sha256
RUN printf '%s\n' '<!doctype html><title>Masanawa APK Verification</title><a href="/masanawa-production.apk">masanawa-production.apk</a><br><a href="/masanawa-production.sha256">SHA-256</a>' > /usr/share/nginx/html/index.html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
