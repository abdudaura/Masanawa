import type { FastifyInstance } from "fastify";

/** Preserve installed clients while exposing the same contracts under v1. */
export function registerApiVersionAliases(app: FastifyInstance): void {
  app.addHook("onRoute", function (route) {
    if (route.url === "/healthz" || route.url === "/readyz" || /^\/v\d+(?:\/|$)/u.test(route.url)) return;
    // Fastify generates HEAD for GET, including the alias GET. Avoid duplicates.
    if (route.method === "HEAD" && this.hasRoute({ method: "HEAD", url: `/v1${route.url}`,
      ...(route.constraints ? { constraints: route.constraints } : {}) })) return;
    this.route({ ...route, url: `/v1${route.url}` });
  });
}
