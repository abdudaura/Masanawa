import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  activateChannelBinding,
  createChannelAccount,
  createPendingChannelBinding,
  revokeChannelBinding,
  transitionChannelAccount,
} from "@masanawa/identity";
import { createCanonicalId } from "@masanawa/contracts";
import { createPostgresChannelBindingRepository } from "./channel_bindings.js";

function fakePool(): Pool {
  const accounts = new Map<string, any>();
  const bindings = new Map<string, any>();

  function accountKey(tenantId: string, channelAccountId: string) {
    return `${tenantId}|${channelAccountId}`;
  }
  function bindingKey(
    tenantId: string,
    channelAccountId: string,
    externalSubjectId: string,
  ) {
    return `${tenantId}|${channelAccountId}|${externalSubjectId}`;
  }

  const client = {
    async query(sql: string, values: readonly unknown[] = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();

      if (
        normalized === "BEGIN" ||
        normalized === "COMMIT" ||
        normalized === "ROLLBACK" ||
        normalized.startsWith("SET TRANSACTION ")
      ) {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.startsWith("INSERT INTO identity.channel_accounts")) {
        const [
          tenantId,
          channelAccountId,
          channel,
          providerAccountRef,
          state,
          revision,
          createdAt,
          updatedAt,
        ] = values as any[];
        const key = accountKey(tenantId, channelAccountId);
        const providerConflict = [...accounts.values()].some(
          (row) =>
            row.tenant_id === tenantId &&
            row.channel === channel &&
            row.provider_account_ref === providerAccountRef,
        );
        if (accounts.has(key) || providerConflict) {
          return { rows: [], rowCount: 0 };
        }
        const row = {
          tenant_id: tenantId,
          channel_account_id: channelAccountId,
          channel,
          provider_account_ref: providerAccountRef,
          state,
          revision: String(revision),
          created_at: new Date(createdAt),
          updated_at: new Date(updatedAt),
        };
        accounts.set(key, row);
        return { rows: [row], rowCount: 1 };
      }

      if (
        normalized.startsWith("SELECT tenant_id, channel_account_id") &&
        normalized.includes("FROM identity.channel_accounts")
      ) {
        const [tenantId, channelAccountId] = values as string[];
        const row = accounts.get(accountKey(tenantId, channelAccountId));
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (normalized.startsWith("UPDATE identity.channel_accounts")) {
        const [
          tenantId,
          channelAccountId,
          state,
          nextRevision,
          updatedAt,
          expectedRevision,
        ] = values as any[];
        const key = accountKey(tenantId, channelAccountId);
        const row = accounts.get(key);
        if (
          !row ||
          row.state === "revoked" ||
          Number(row.revision) !== expectedRevision
        ) {
          return { rows: [], rowCount: 0 };
        }
        const next = {
          ...row,
          state,
          revision: String(nextRevision),
          updated_at: new Date(updatedAt),
        };
        accounts.set(key, next);
        return { rows: [next], rowCount: 1 };
      }

      if (normalized.startsWith("INSERT INTO identity.channel_bindings")) {
        const [
          tenantId,
          channelAccountId,
          channel,
          userId,
          externalSubjectId,
          state,
          revision,
          createdAt,
          updatedAt,
        ] = values as any[];
        const key = bindingKey(tenantId, channelAccountId, externalSubjectId);
        if (bindings.has(key)) return { rows: [], rowCount: 0 };
        const row = {
          tenant_id: tenantId,
          channel_account_id: channelAccountId,
          channel,
          user_id: userId,
          external_subject_id: externalSubjectId,
          state,
          proof_method: null,
          proof_evidence_ref: null,
          proof_verified_at: null,
          revision: String(revision),
          created_at: new Date(createdAt),
          updated_at: new Date(updatedAt),
        };
        bindings.set(key, row);
        return { rows: [row], rowCount: 1 };
      }

      if (
        normalized.startsWith("SELECT tenant_id, channel_account_id") &&
        normalized.includes("FROM identity.channel_bindings") &&
        normalized.includes("external_subject_id=$3")
      ) {
        const [tenantId, channelAccountId, externalSubjectId] =
          values as string[];
        const row = bindings.get(
          bindingKey(tenantId, channelAccountId, externalSubjectId),
        );
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (
        normalized.startsWith("SELECT tenant_id, channel_account_id") &&
        normalized.includes("FROM identity.channel_bindings") &&
        normalized.includes("user_id=$3") &&
        normalized.includes("state='active'")
      ) {
        const [tenantId, channelAccountId, userId] = values as string[];
        const rows = [...bindings.values()].filter(
          (row) =>
            row.tenant_id === tenantId &&
            row.channel_account_id === channelAccountId &&
            row.user_id === userId &&
            row.state === "active",
        );
        return { rows, rowCount: rows.length };
      }

      if (normalized.startsWith("UPDATE identity.channel_bindings")) {
        const [
          tenantId,
          channelAccountId,
          externalSubjectId,
          state,
          proofMethod,
          proofEvidenceRef,
          proofVerifiedAt,
          nextRevision,
          updatedAt,
          expectedRevision,
        ] = values as any[];
        const key = bindingKey(
          tenantId,
          channelAccountId,
          externalSubjectId,
        );
        const row = bindings.get(key);
        if (
          !row ||
          row.state === "revoked" ||
          Number(row.revision) !== expectedRevision
        ) {
          return { rows: [], rowCount: 0 };
        }
        const next = {
          ...row,
          state,
          proof_method: proofMethod,
          proof_evidence_ref: proofEvidenceRef,
          proof_verified_at:
            proofVerifiedAt === null ? null : new Date(proofVerifiedAt),
          revision: String(nextRevision),
          updated_at: new Date(updatedAt),
        };
        bindings.set(key, next);
        return { rows: [next], rowCount: 1 };
      }

      throw new Error(`Unhandled fake SQL: ${normalized}`);
    },
    release() {},
  };

  return {
    async connect() {
      return client as any;
    },
  } as unknown as Pool;
}

describe("Postgres channel binding repository", () => {
  it("replays exact account/binding creates and persists activation", async () => {
    const repository = createPostgresChannelBindingRepository(fakePool());
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const channelAccountId = createCanonicalId("channel-account");

    const account = createChannelAccount({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      providerAccountRef: "wa-business-001",
      createdAt: "2026-10-06T16:00:00.000Z" as never,
    });

    expect(await repository.createAccount({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      providerAccountRef: "wa-business-001",
      createdAt: account.createdAt,
    })).toEqual(account);

    expect(await repository.createAccount({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      providerAccountRef: "wa-business-001",
      createdAt: account.createdAt,
    })).toEqual(account);

    const pending = createPendingChannelBinding({
      account,
      userId,
      externalSubjectId: "wa:+2348012345678",
      createdAt: "2026-10-06T16:01:00.000Z" as never,
    });

    expect(await repository.createPendingBinding({
      account,
      userId,
      externalSubjectId: pending.externalSubjectId,
      createdAt: pending.createdAt,
    })).toEqual(pending);

    expect(await repository.createPendingBinding({
      account,
      userId,
      externalSubjectId: pending.externalSubjectId,
      createdAt: pending.createdAt,
    })).toEqual(pending);

    const active = activateChannelBinding({
      account,
      binding: pending,
      expectedRevision: pending.revision,
      proof: {
        purpose: "account-link",
        method: "channel-possession-challenge",
        evidenceRef: "evidence:channel-link-001",
        verifiedAt: "2026-10-06T16:01:30.000Z" as never,
      },
      activatedAt: "2026-10-06T16:02:00.000Z" as never,
    });

    expect(await repository.putBinding(active)).toEqual(active);
    expect(
      await repository.readActiveBindingForUser({
        tenantId,
        channelAccountId,
        userId,
      }),
    ).toEqual(active);
  });

  it("fails closed on conflicting create replay", async () => {
    const repository = createPostgresChannelBindingRepository(fakePool());
    const tenantId = createCanonicalId("tenant");
    const channelAccountId = createCanonicalId("channel-account");

    await repository.createAccount({
      tenantId,
      channelAccountId,
      channel: "telegram",
      providerAccountRef: "bot-001",
      createdAt: "2026-10-06T16:00:00.000Z" as never,
    });

    await expect(
      repository.createAccount({
        tenantId,
        channelAccountId,
        channel: "telegram",
        providerAccountRef: "bot-CHANGED",
        createdAt: "2026-10-06T16:00:00.000Z" as never,
      }),
    ).rejects.toThrow("create replay conflicted");
  });

  it("preserves terminal revocation for binding and account", async () => {
    const repository = createPostgresChannelBindingRepository(fakePool());
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const channelAccountId = createCanonicalId("channel-account");

    const account = await repository.createAccount({
      tenantId,
      channelAccountId,
      channel: "whatsapp",
      providerAccountRef: "wa-business-002",
      createdAt: "2026-10-06T16:00:00.000Z" as never,
    });

    const pending = await repository.createPendingBinding({
      account,
      userId,
      externalSubjectId: "wa:+2348099999999",
      createdAt: "2026-10-06T16:01:00.000Z" as never,
    });
    const active = await repository.putBinding(
      activateChannelBinding({
        account,
        binding: pending,
        expectedRevision: pending.revision,
        proof: {
          purpose: "account-link",
          method: "channel-possession-challenge",
          evidenceRef: "evidence:channel-link-002",
          verifiedAt: "2026-10-06T16:01:30.000Z" as never,
        },
        activatedAt: "2026-10-06T16:02:00.000Z" as never,
      }),
    );
    const revokedBinding = revokeChannelBinding({
      binding: active,
      expectedRevision: active.revision,
      revokedAt: "2026-10-06T16:03:00.000Z" as never,
    });
    expect(await repository.putBinding(revokedBinding)).toEqual(revokedBinding);

    await expect(
      repository.putBinding({
        ...revokedBinding,
        state: "active",
        revision: revokedBinding.revision + 1,
        updatedAt: "2026-10-06T16:04:00.000Z" as never,
      }),
    ).rejects.toThrow("terminal");

    const revokedAccount = transitionChannelAccount({
      account,
      expectedRevision: account.revision,
      state: "revoked",
      changedAt: "2026-10-06T16:03:00.000Z" as never,
    });
    expect(await repository.putAccount(revokedAccount)).toEqual(revokedAccount);

    await expect(
      repository.putAccount({
        ...revokedAccount,
        state: "active",
        revision: revokedAccount.revision + 1,
        updatedAt: "2026-10-06T16:04:00.000Z" as never,
      }),
    ).rejects.toThrow("terminal");
  });

  it("rejects revision advances that move updatedAt backwards", async () => {
    const repository = createPostgresChannelBindingRepository(fakePool());
    const tenantId = createCanonicalId("tenant");
    const channelAccountId = createCanonicalId("channel-account");

    const account = await repository.createAccount({
      tenantId,
      channelAccountId,
      channel: "telegram",
      providerAccountRef: "bot-003",
      createdAt: "2026-10-06T16:00:00.000Z" as never,
    });
    const disabled = await repository.putAccount(
      transitionChannelAccount({
        account,
        expectedRevision: account.revision,
        state: "disabled",
        changedAt: "2026-10-06T16:10:00.000Z" as never,
      }),
    );

    await expect(
      repository.putAccount({
        ...disabled,
        state: "active",
        revision: disabled.revision + 1,
        updatedAt: "2026-10-06T16:05:00.000Z" as never,
      }),
    ).rejects.toThrow("cannot move backwards");
  });
});
