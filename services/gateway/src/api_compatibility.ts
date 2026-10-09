import type { FastifyInstance } from "fastify";

/** Audited existing client URLs. New routes must use /v1; no broad exemption. */
export const legacyVersionedPaths = [
  "/account/deletion",
  "/account/deletion/request",
  "/account/deletion/verify",
  "/activity",
  "/admin/channels/whatsapp/qr",
  "/admin/channels/whatsapp/reset",
  "/admin/channels/whatsapp/status",
  "/admin/talk-safety/:kind/:targetId",
  "/assistant/workspace",
  "/assistant/workspace/persona",
  "/assistant/workspace/sessions",
  "/assistant/workspace/sessions/:sessionId/turn",
  "/assistant/workspace/turns/:requestId/status",
  "/channels/telegram/webhook",
  "/channels/whatsapp/webhook",
  "/home",
  "/me/saved-talks",
  "/me/saved-talks/:talkId",
  "/me/talks",
  "/messages",
  "/messages/:conversationId",
  "/messages/:conversationId/read",
  "/messages/:conversationId/voice-notes",
  "/messages/contacts",
  "/messages/contacts/:otherUserId",
  "/messages/contacts/lookup/:handle",
  "/messages/contacts/preferences",
  "/messages/contacts/requests",
  "/messages/contacts/requests/:requesterId/response",
  "/messages/items/:messageId",
  "/messages/sync",
  "/messages/voice/:messageId",
  "/personas/:publicId",
  "/profiles/:handle",
  "/profiles/:handle/follow",
  "/profiles/by-user/:userId",
  "/profiles/by-user/:userId/follow",
  "/profiles/me",
  "/profiles/me/avatar",
  "/safety/profiles/:handle/preference",
  "/safety/reports",
  "/safety/users/:userId/preference",
  "/search",
  "/talks",
  "/talks/:talkId",
  "/talks/:talkId/ai-seat-quotes",
  "/talks/:talkId/ai-seat-quotes/:quoteId/confirm",
  "/talks/:talkId/ai-seats",
  "/talks/:talkId/comments",
  "/talks/:talkId/end",
  "/talks/:talkId/gifts",
  "/talks/:talkId/gifts/catalog",
  "/talks/:talkId/host-controls",
  "/talks/:talkId/host-participants/:participantId",
  "/talks/:talkId/host-questions",
  "/talks/:talkId/host-questions/:questionId",
  "/talks/:talkId/host-requests/:requestId",
  "/talks/:talkId/invitation-response",
  "/talks/:talkId/invitations",
  "/talks/:talkId/leave-seat",
  "/talks/:talkId/live/connect",
  "/talks/:talkId/live/disconnect",
  "/talks/:talkId/live/heartbeat",
  "/talks/:talkId/live/media-token",
  "/talks/:talkId/live/state",
  "/talks/:talkId/participation",
  "/talks/:talkId/poll",
  "/talks/:talkId/polls",
  "/talks/:talkId/polls/:pollId/close",
  "/talks/:talkId/polls/:pollId/vote",
  "/talks/:talkId/questions",
  "/talks/:talkId/raise-hand",
  "/talks/:talkId/reactions",
  "/talks/:talkId/replay",
  "/talks/:talkId/replay/playback",
  "/talks/:talkId/replay/publication",
  "/talks/:talkId/replay/recording",
  "/talks/:talkId/twin-seats/:seatId/direct",
  "/talks/:talkId/twin-seats/mine"
] as const;

export function registerVersionedCompatibility(app: FastifyInstance): void {
  const admitted = new Set<string>(legacyVersionedPaths);
  const registered = new Set<string>();
  app.addHook("onRoute", function (route) {
    if (!admitted.has(route.url)) return;
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const pending = methods.filter(method => !registered.has(method + " " + route.url));
    if (!pending.length) return;
    for (const method of pending) registered.add(method + " " + route.url);
    // Share the same handler, validators, authorization and response schema.
    // /v1 URLs are absent from admitted, preventing recursive registration.
    this.route({ ...route, method: pending, url: "/v1" + route.url, exposeHeadRoute: false });
  });
}
