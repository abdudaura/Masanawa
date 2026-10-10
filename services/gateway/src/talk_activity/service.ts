import type { PlatformSessionIdentity } from "@masanawa/security";
import {
  toTalkActivityItem,
  type TalkActivityFilter,
  type TalkActivityItem,
  type TalkActivityRepository,
} from "./model.js";

export interface TalkActivityAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export interface TalkActivityService {
  markRead(input: Readonly<{
    authorizationHeader: string | undefined;
    activityId: string;
  }>): Promise<Readonly<{ id: string; unread: false }>>;
  read(input: Readonly<{
    authorizationHeader: string | undefined;
    filter: TalkActivityFilter;
    limit: number;
  }>): Promise<readonly TalkActivityItem[]>;
}

export function createTalkActivityService(input: Readonly<{
  repository: TalkActivityRepository;
  authorizer: TalkActivityAuthorizer;
}>): TalkActivityService {
  return Object.freeze<TalkActivityService>({
    async markRead(request) {
      const identity = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const updated = await input.repository.markRead({
        tenantId: identity.tenantId,
        userId: identity.userId,
        activityId: request.activityId,
      });
      if (!updated) {
        // Do not disclose whether another account owns the requested ID.
        throw Object.assign(new Error("ACTIVITY_NOT_FOUND"), {
          statusCode: 404,
          code: "ACTIVITY_NOT_FOUND",
        });
      }
      return Object.freeze({ id: request.activityId, unread: false as const });
    },

    async read(request) {
      const identity = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const records = await input.repository.list({
        tenantId: identity.tenantId,
        userId: identity.userId,
        filter: request.filter,
        limit: request.limit,
      });
      return Object.freeze(records.map(toTalkActivityItem));
    },
  });
}
