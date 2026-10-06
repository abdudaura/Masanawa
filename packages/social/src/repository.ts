import type {
  Instant,
  SocialContentId,
  TenantId,
} from "@masanawa/contracts";
import {
  appendSocialContentRevision,
  createSocialAccountBinding,
  createSocialContent,
  transitionSocialAccountBinding,
  transitionSocialContentState,
  type AppendSocialContentRevisionInput,
  type CreateSocialAccountBindingInput,
  type CreateSocialContentInput,
  type SocialAccountBinding,
  type SocialAccountState,
  type SocialContentSnapshot,
  type SocialContentState,
} from "./model.js";

export interface SocialRepository {
  createAccount(
    input: CreateSocialAccountBindingInput,
  ): Promise<{ readonly record: SocialAccountBinding; readonly reused: boolean }>;

  readAccount(input: {
    readonly tenantId: TenantId;
    readonly accountKey: string;
  }): Promise<SocialAccountBinding | null>;

  transitionAccount(input: {
    readonly tenantId: TenantId;
    readonly accountKey: string;
    readonly expectedRevision: number;
    readonly nextState: SocialAccountState;
    readonly updatedAt: Instant;
  }): Promise<SocialAccountBinding>;

  createContent(
    input: CreateSocialContentInput,
  ): Promise<{ readonly snapshot: SocialContentSnapshot; readonly reused: boolean }>;

  readContent(input: {
    readonly tenantId: TenantId;
    readonly socialContentId: SocialContentId;
  }): Promise<SocialContentSnapshot | null>;

  appendContentRevision(
    input: AppendSocialContentRevisionInput,
  ): Promise<SocialContentSnapshot>;

  transitionContent(input: {
    readonly tenantId: TenantId;
    readonly socialContentId: SocialContentId;
    readonly expectedLifecycleRevision: number;
    readonly nextState: SocialContentState;
    readonly updatedAt: Instant;
  }): Promise<SocialContentSnapshot>;

  listContentRevisions(input: {
    readonly tenantId: TenantId;
    readonly socialContentId: SocialContentId;
  }): Promise<readonly SocialContentSnapshot["currentRevision"][]>;
}

function accountMapKey(tenantId: TenantId, accountKey: string): string {
  return `${tenantId}\0${accountKey}`;
}

function contentMapKey(
  tenantId: TenantId,
  socialContentId: SocialContentId,
): string {
  return `${tenantId}\0${socialContentId}`;
}

function same(value: unknown, other: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(other);
}

export class InMemorySocialRepository implements SocialRepository {
  readonly #accounts = new Map<string, SocialAccountBinding>();
  readonly #contents = new Map<string, SocialContentSnapshot>();
  readonly #revisions = new Map<
    string,
    SocialContentSnapshot["currentRevision"][]
  >();

  async createAccount(input: CreateSocialAccountBindingInput) {
    const record = createSocialAccountBinding(input);
    const key = accountMapKey(record.tenantId, record.accountKey);
    const existing = this.#accounts.get(key);
    if (existing !== undefined) {
      if (!same(existing, record)) {
        throw new Error(
          "social account identity already exists with different binding",
        );
      }
      return Object.freeze({ record: existing, reused: true as const });
    }
    this.#accounts.set(key, record);
    return Object.freeze({ record, reused: false as const });
  }

  async readAccount(input: {
    readonly tenantId: TenantId;
    readonly accountKey: string;
  }): Promise<SocialAccountBinding | null> {
    return (
      this.#accounts.get(accountMapKey(input.tenantId, input.accountKey)) ?? null
    );
  }

  async transitionAccount(input: {
    readonly tenantId: TenantId;
    readonly accountKey: string;
    readonly expectedRevision: number;
    readonly nextState: SocialAccountState;
    readonly updatedAt: Instant;
  }): Promise<SocialAccountBinding> {
    const key = accountMapKey(input.tenantId, input.accountKey);
    const current = this.#accounts.get(key);
    if (current === undefined) throw new Error("social account binding not found");
    const next = transitionSocialAccountBinding({
      current,
      expectedRevision: input.expectedRevision,
      nextState: input.nextState,
      updatedAt: input.updatedAt,
    });
    this.#accounts.set(key, next);
    return next;
  }

  async createContent(input: CreateSocialContentInput) {
    const snapshot = createSocialContent(input);
    this.#assertTargets(
      snapshot.content.tenantId,
      snapshot.content.characterId,
      snapshot.currentRevision.targetAccountKeys,
    );

    const key = contentMapKey(
      snapshot.content.tenantId,
      snapshot.content.socialContentId,
    );
    const existing = this.#contents.get(key);
    if (existing !== undefined) {
      if (!same(existing, snapshot)) {
        throw new Error(
          "social content identity already exists with different content",
        );
      }
      return Object.freeze({ snapshot: existing, reused: true as const });
    }

    this.#contents.set(key, snapshot);
    this.#revisions.set(key, [snapshot.currentRevision]);
    return Object.freeze({ snapshot, reused: false as const });
  }

  async readContent(input: {
    readonly tenantId: TenantId;
    readonly socialContentId: SocialContentId;
  }): Promise<SocialContentSnapshot | null> {
    return (
      this.#contents.get(
        contentMapKey(input.tenantId, input.socialContentId),
      ) ?? null
    );
  }

  async appendContentRevision(
    input: AppendSocialContentRevisionInput,
  ): Promise<SocialContentSnapshot> {
    const key = contentMapKey(input.tenantId, input.socialContentId);
    const current = this.#contents.get(key);
    if (current === undefined) throw new Error("social content not found");

    const next = appendSocialContentRevision({
      current,
      revision: input,
    });
    this.#assertTargets(
      next.content.tenantId,
      next.content.characterId,
      next.currentRevision.targetAccountKeys,
    );
    this.#contents.set(key, next);
    const revisions = this.#revisions.get(key);
    if (revisions === undefined) {
      throw new Error("social content revision store is unavailable");
    }
    revisions.push(next.currentRevision);
    return next;
  }

  async transitionContent(input: {
    readonly tenantId: TenantId;
    readonly socialContentId: SocialContentId;
    readonly expectedLifecycleRevision: number;
    readonly nextState: SocialContentState;
    readonly updatedAt: Instant;
  }): Promise<SocialContentSnapshot> {
    const key = contentMapKey(input.tenantId, input.socialContentId);
    const current = this.#contents.get(key);
    if (current === undefined) throw new Error("social content not found");

    if (
      input.nextState === "approved" ||
      input.nextState === "publication-pending"
    ) {
      this.#assertTargets(
        current.content.tenantId,
        current.content.characterId,
        current.currentRevision.targetAccountKeys,
      );
    }

    const content = transitionSocialContentState({
      current: current.content,
      expectedLifecycleRevision: input.expectedLifecycleRevision,
      nextState: input.nextState,
      updatedAt: input.updatedAt,
    });
    const next = Object.freeze({
      content,
      currentRevision: current.currentRevision,
    });
    this.#contents.set(key, next);
    return next;
  }

  async listContentRevisions(input: {
    readonly tenantId: TenantId;
    readonly socialContentId: SocialContentId;
  }): Promise<readonly SocialContentSnapshot["currentRevision"][]> {
    const revisions =
      this.#revisions.get(
        contentMapKey(input.tenantId, input.socialContentId),
      ) ?? [];
    return Object.freeze([...revisions]);
  }

  #assertTargets(
    tenantId: TenantId,
    characterId: SocialContentSnapshot["content"]["characterId"],
    accountKeys: readonly string[],
  ): void {
    for (const accountKey of accountKeys) {
      const account = this.#accounts.get(accountMapKey(tenantId, accountKey));
      if (account === undefined) {
        throw new Error("social content target account is not bound");
      }
      if (account.characterId !== characterId) {
        throw new Error(
          "social content target account belongs to another Character",
        );
      }
      if (account.state !== "active") {
        throw new Error("social content target account is not active");
      }
    }
  }
}
