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
  return Object.freeze({
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
