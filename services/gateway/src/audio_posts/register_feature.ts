/** AF09 Published Talks: one authenticated feature registration contract.
 * AF00 alone wires this into the canonical Gateway app after the social
 * migration, AF08 principal, TalkSafety and AF15 private-media authorities exist.
 * There is no alternate identity resolver, fake media adapter or public
 * moderation/settlement route here.
 */
import type { FastifyInstance } from "fastify";
import { registerAudioPostRoutes } from "./routes.js";
import { registerAudioFollowingRoutes } from "./following_routes.js";
import { registerAudioPostPlaybackRoutes } from "./playback.js";
import { registerPublishedAudioReportRoutes } from "./reporting.js";

type PostDependencies = Parameters<typeof registerAudioPostRoutes>[1];
type FollowingDependencies = Parameters<typeof registerAudioFollowingRoutes>[1];
type PlaybackDependencies = Parameters<typeof registerAudioPostPlaybackRoutes>[1];
type ReportDependencies = Parameters<typeof registerPublishedAudioReportRoutes>[1];

/** AF00 must provide real, server-authorized dependencies; no public caller
 * can substitute tenant/account details or make a client-side media grant.
 */
export interface PublishedAudioFeatureDependencies {
  requireActor: PostDependencies["requireActor"];
  posts: PostDependencies["service"];
  following: FollowingDependencies["service"];
  playback: PlaybackDependencies["service"];
  report: Omit<ReportDependencies, "requireActor">;
}

const method = (value: unknown): boolean => typeof value === "function";
const methods = (value: unknown, names: readonly string[]): boolean =>
  typeof value === "object" && value !== null &&
  names.every(name => method((value as Record<string, unknown>)[name]));

/** Refuse an incomplete service pack BEFORE adding any routes. In particular,
 * an unavailable canonical TalkSafety reporting authority must not silently
 * produce a falsely enabled report control; integrators disable the complete
 * feature until these concrete bindings and its migration are available.
 */
export function registerPublishedAudioFeatureRoutes(
  app: FastifyInstance, deps: PublishedAudioFeatureDependencies,
): void {
  if (!deps || !method(deps.requireActor) ||
      !methods(deps.posts, [
        "publish", "feed", "receiptByRequest", "mine", "saved", "removeOwn",
        "reaction", "comments", "commentsPage", "comment", "removeOwnComment",
      ]) ||
      !methods(deps.following, ["set", "status", "creatorFeed", "feed"]) ||
      !methods(deps.playback, ["ticket", "countListen"]) ||
      !deps.report ||
      !methods(deps.report.repository, ["byId"]) ||
      !methods(deps.report.visibility, ["canView"]) ||
      !methods(deps.report.safety, ["report"])) {
    throw new Error("audio_posts.feature_dependencies_missing");
  }

  const requireActor = deps.requireActor;
  registerAudioPostRoutes(app, { service: deps.posts, requireActor });
  registerAudioFollowingRoutes(app, { service: deps.following, requireActor });
  registerAudioPostPlaybackRoutes(app, { service: deps.playback, requireActor });
  registerPublishedAudioReportRoutes(app, { ...deps.report, requireActor });
}
