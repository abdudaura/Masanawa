import { randomUUID } from "node:crypto";
import {
  createPostgresPool,
  platformProductMigrationRoots,
  runMigrations,
  type Pool,
} from "@masanawa/postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresHumanContactRepository } from "./postgres_repository.js";

/**
 * Opt-in, real PostgreSQL contract. Never run against any non-local or
 * production database. CI must supply a disposable *_test database and
 * explicitly opt in; no pretend SQL-string tests count as DB verification.
 */
const databaseUrl = process.env.MASANAWA_C01_TEST_DATABASE_URL;
function safeTestDatabase(value: string | undefined): boolean {
  if (!value || process.env.MASANAWA_C01_ENABLE_DB_TESTS !== "yes") return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
      decodeURIComponent(parsed.pathname).endsWith("_test");
  } catch {
    return false;
  }
}

const databaseEnabled = safeTestDatabase(databaseUrl);
const run = databaseEnabled ? describe : describe.skip;

run("C01 canonical PostgreSQL contact admission integration", () => {
  let pool: Pool;
  const nonce = randomUUID().replaceAll("-", "").slice(0, 10);
  const tenant = `c01_test_${nonce}`;
  const otherTenant = `c01_other_${nonce}`;
  const pageTenant = `c01_page_${nonce}`;
  const alice = `c01_alice_${nonce}`;
  const bob = `c01_bob_${nonce}`;
  const outsider = `c01_else_${nonce}`;
  const bobHandle = `bob_${nonce}`;
  const aliceHandle = `alice_${nonce}`;
  const otherHandle = `remote_${nonce}`;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: databaseUrl!,
      applicationName: "masanawa-c01-disposable-postgres-integration",
      max: 4,
    });
    // Applies the exact production migration manifest, including C01 0016.
    await runMigrations(pool, platformProductMigrationRoots());
    for (const id of [tenant, otherTenant]) {
      await pool.query(
        `INSERT INTO identity.tenants(tenant_id, created_at, updated_at)
          VALUES ($1, clock_timestamp(), clock_timestamp())`,
        [id],
      );
    }
    for (const userId of [alice, bob, outsider]) {
      await pool.query(
        `INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
          VALUES ($1,$2,clock_timestamp(),clock_timestamp())`,
        [tenant, userId],
      );
    }
    await pool.query(
      `INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
       VALUES ($1,$2,clock_timestamp(),clock_timestamp())`,
      [otherTenant, outsider],
    );
    for (const [id, handle] of [[alice, aliceHandle], [bob, bobHandle]] as const) {
      await pool.query(
        `INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name)
         VALUES ($1,$2,$3,$4)`,
        [tenant, id, handle, handle],
      );
    }
    await pool.query(
      `INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name)
       VALUES ($1,$2,$3,$4)`,
      [otherTenant, outsider, otherHandle, otherHandle],
    );
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    try {
      // Only delete ephemeral, randomly named test tenants created above.
      for (const id of [tenant, otherTenant, pageTenant]) {
        await pool.query(`DELETE FROM talks.safety_preferences WHERE tenant_id=$1`, [id]);
        await pool.query(`DELETE FROM talks.safety_enforcement WHERE tenant_id=$1`, [id]);
        await pool.query(`DELETE FROM talks.human_dm_contact_requests WHERE tenant_id=$1`, [id]);
        await pool.query(`DELETE FROM talks.human_dm_preferences WHERE tenant_id=$1`, [id]);
        await pool.query(`DELETE FROM talks.public_profiles WHERE tenant_id=$1`, [id]);
        await pool.query(`DELETE FROM identity.users WHERE tenant_id=$1`, [id]);
        await pool.query(`DELETE FROM identity.tenants WHERE tenant_id=$1`, [id]);
      }
    } finally {
      await pool.end();
    }
  });

  it("isolates tenants, hides self and requires active discoverable recipient", async () => {
    const repo = createPostgresHumanContactRepository(pool);
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle }))
      .toMatchObject({ userId: bob, status: "none", canMessage: false });
    expect(await repo.lookup({ tenantId: tenant, viewerId: bob, handle: bobHandle })).toBeNull();
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: otherHandle })).toBeNull();
    await repo.setOwnPreferences({
      tenantId: tenant, userId: bob, discoverableByHandle: false,
    });
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle })).toBeNull();
    await repo.setOwnPreferences({
      tenantId: tenant, userId: bob, discoverableByHandle: true,
    });
  });

  it("idempotently requests, approves and revokes an exact unique user pair", async () => {
    const repo = createPostgresHumanContactRepository(pool);
    const answers = await Promise.all([
      repo.request({ tenantId: tenant, requesterId: alice, handle: bobHandle }),
      repo.request({ tenantId: tenant, requesterId: alice, handle: bobHandle }),
    ]);
    expect(answers).toEqual(["pending", "pending"]);
    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM talks.human_dm_contact_requests
       WHERE tenant_id=$1`, [tenant],
    );
    expect(count.rows[0]?.count).toBe("1");
    const incoming = await repo.list({ tenantId: tenant, userId: bob, limit: 30 });
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ userId: alice, status: "incoming" });
    expect(await repo.respond({
      tenantId: tenant, recipientId: alice, requesterId: bob, requestRevision: "1", accept: true,
    })).toBe(false);
    // Moderation intervening after request creation must deny stale approval.
    await pool.query(
      `INSERT INTO talks.safety_enforcement
       (tenant_id,target_kind,target_id,revision,visibility,reason_code,updated_at)
       VALUES ($1,'profile',$2,1,'restricted','moderation',clock_timestamp())`,
      [tenant, aliceHandle],
    );
    expect(await repo.respond({
      tenantId: tenant, recipientId: bob, requesterId: alice, requestRevision: "1", accept: true,
    })).toBe(false);
    await pool.query(
      `DELETE FROM talks.safety_enforcement
       WHERE tenant_id=$1 AND target_kind='profile' AND target_id=$2`,
      [tenant, aliceHandle],
    );
    expect(await repo.respond({
      tenantId: tenant, recipientId: bob, requesterId: alice, requestRevision: "1", accept: true,
    })).toBe(true);
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle }))
      .toMatchObject({ status: "accepted", canMessage: true });
    expect(await repo.revoke({
      tenantId: tenant, actorId: alice, otherUserId: bob,
    })).toBe(true);
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle }))
      .toMatchObject({ status: "revoked", canMessage: false });
    expect(await repo.list({ tenantId: tenant, userId: alice, limit: 30 }))
      .toContainEqual(expect.objectContaining({ userId: bob, status: "revoked", requestRevision: "1" }));
    expect(await repo.list({ tenantId: tenant, userId: bob, limit: 30 }))
      .toHaveLength(0);
    expect(await repo.lookup({ tenantId: tenant, viewerId: bob, handle: aliceHandle }))
      .toMatchObject({ status: "declined", canMessage: false });
    // A past invitation response cannot override the revoker's choice.
    expect(await repo.respond({
      tenantId: tenant, recipientId: bob, requesterId: alice, requestRevision: "1", accept: true,
    })).toBe(false);
    expect(await repo.request({ tenantId: tenant, requesterId: bob, handle: aliceHandle }))
      .toBe("existing");
    // Reconnect is a new pending consent flow, never automatic acceptance.
    await repo.setOwnPreferences({ tenantId: tenant, userId: bob, policy: "anyone" });
    expect(await repo.request({ tenantId: tenant, requesterId: alice, handle: bobHandle }))
      .toBe("pending");
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle }))
      .toMatchObject({ status: "outgoing", canMessage: false, requestRevision: "2" });
    expect(await repo.respond({
      tenantId: tenant, recipientId: bob, requesterId: alice, requestRevision: "1", accept: true,
    })).toBe(false);
    expect(await repo.respond({
      tenantId: tenant, recipientId: bob, requesterId: alice, requestRevision: "2", accept: true,
    })).toBe(true);
    // Now Bob revokes; Alice cannot approve the previous relationship again.
    expect(await repo.revoke({
      tenantId: tenant, actorId: bob, otherUserId: alice,
    })).toBe(true);
    expect(await repo.respond({
      tenantId: tenant, recipientId: bob, requesterId: alice, requestRevision: "2", accept: true,
    })).toBe(false);
  });

  it("never flips a terminal invitation with a stale consent response", async () => {
    // Separate pairs avoid mutating the existing Alice/Bob integration scenario.
    const sender = `c01_fence_sender_${nonce}`;
    const declinedPeer = `c01_fence_declined_${nonce}`;
    const acceptedPeer = `c01_fence_accepted_${nonce}`;
    const declinedHandle = `fence_declined_${nonce}`;
    const acceptedHandle = `fence_accepted_${nonce}`;
    for (const [id, userHandle] of [
      [sender, `fence_sender_${nonce}`],
      [declinedPeer, declinedHandle],
      [acceptedPeer, acceptedHandle],
    ] as const) {
      await pool.query(
        `INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
         VALUES ($1,$2,clock_timestamp(),clock_timestamp())`, [tenant, id],
      );
      await pool.query(
        `INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name)
         VALUES ($1,$2,$3,$3)`, [tenant, id, userHandle],
      );
    }

    const repo = createPostgresHumanContactRepository(pool);
    for (const [recipient, recipientHandle, accept] of [
      [declinedPeer, declinedHandle, false],
      [acceptedPeer, acceptedHandle, true],
    ] as const) {
      expect(await repo.request({
        tenantId: tenant, requesterId: sender, handle: recipientHandle,
      })).toBe("pending");
      const incoming = (await repo.list({
        tenantId: tenant, userId: recipient, limit: 30,
      })).find(entry => entry.userId === sender);
      expect(incoming?.status).toBe("incoming");
      const revision = incoming!.requestRevision;

      expect(await repo.respond({
        tenantId: tenant, recipientId: recipient, requesterId: sender,
        requestRevision: revision, accept,
      })).toBe(true);

      // Pin the timestamp to make a duplicate-write ordering bug deterministic.
      await pool.query(
        `UPDATE talks.human_dm_contact_requests
            SET updated_at='2026-10-01T00:00:00.123456Z'::timestamptz
          WHERE tenant_id=$1 AND first_user_id=LEAST($2::text,$3::text)
            AND second_user_id=GREATEST($2::text,$3::text)`,
        [tenant, sender, recipient],
      );
      const readStatus = async () => (await pool.query<{
        status: string; stamped_at: string;
      }>(
        `SELECT status, updated_at::text AS stamped_at
           FROM talks.human_dm_contact_requests
          WHERE tenant_id=$1 AND first_user_id=LEAST($2::text,$3::text)
            AND second_user_id=GREATEST($2::text,$3::text)`,
        [tenant, sender, recipient],
      )).rows[0];

      const beforeRetry = await readStatus();
      expect(beforeRetry?.status).toBe(accept ? "accepted" : "declined");
      // Opposite final decision is forbidden without a *new pending revision*.
      expect(await repo.respond({
        tenantId: tenant, recipientId: recipient, requesterId: sender,
        requestRevision: revision, accept: !accept,
      })).toBe(false);
      // Exact-result retries remain safe for flaky networks and do not reorder.
      expect(await repo.respond({
        tenantId: tenant, recipientId: recipient, requesterId: sender,
        requestRevision: revision, accept,
      })).toBe(true);
      expect(await readStatus()).toEqual(beforeRetry);
    }
  });

  it("iterates equal-microsecond edges without repeats, leaks or offset scans", async () => {
    const viewer = `c01_page_viewer_${nonce}`;
    const peers = [0, 1, 2, 3].map(n => `c01_page_peer_${n}_${nonce}`);
    await pool.query(
      `INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
       VALUES ($1,clock_timestamp(),clock_timestamp())`, [pageTenant],
    );
    for (const user of [viewer, ...peers]) {
      await pool.query(
        `INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
         VALUES ($1,$2,clock_timestamp(),clock_timestamp())`,
        [pageTenant, user],
      );
      await pool.query(
        `INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name)
         VALUES ($1,$2,$3,$3)`,
        [pageTenant, user, `p_${user}`],
      );
    }
    for (const [index, peer] of peers.entries()) {
      const sameTimestamp = index < 2
        ? "2026-10-08T11:00:00.123456Z" : "2026-10-08T10:00:00.123456Z";
      await pool.query(
        `INSERT INTO talks.human_dm_contact_requests
           (tenant_id,first_user_id,second_user_id,requested_by,status,updated_at)
         VALUES ($1,LEAST($2::text,$3::text),GREATEST($2::text,$3::text),
                 $2,'accepted',$4::timestamptz)`,
        [pageTenant, viewer, peer, sameTimestamp],
      );
    }
    const repo = createPostgresHumanContactRepository(pool);
    const first = await repo.listPage!({
      tenantId: pageTenant, userId: viewer, limit: 2, after: null,
    });
    expect(first.contacts).toHaveLength(2);
    expect(first.next).toMatchObject({
      updatedAt: "2026-10-08T11:00:00.123456Z",
    });
    const second = await repo.listPage!({
      tenantId: pageTenant, userId: viewer, limit: 2, after: first.next,
    });
    expect(second.contacts).toHaveLength(2);
    expect(second.next).toBeNull();
    expect([...first.contacts, ...second.contacts].map(x => x.userId))
      .toEqual(peers);
    expect((await repo.listPage!({
      tenantId: otherTenant, userId: outsider, limit: 2, after: null,
    })).contacts).toHaveLength(0);
    await pool.query(
      `INSERT INTO talks.safety_preferences
        (tenant_id,viewer_user_id,subject_user_id,blocked,updated_at)
       VALUES ($1,$2,$3,true,clock_timestamp())`,
      [pageTenant, peers[0], viewer],
    );
    const afterBlock = await repo.listPage!({
      tenantId: pageTenant, userId: viewer, limit: 4, after: null,
    });
    expect(afterBlock.contacts.map(x => x.userId)).not.toContain(peers[0]);
  });

  it("blocks revoked sessions after actor disablement while allowing revocation of a disabled peer", async () => {
    // Use a dedicated pair so existing consent and pagination tests are untouched.
    const activeRevoker = `c01_active_revoker_${nonce}`;
    const disabledPeer = `c01_disabled_peer_${nonce}`;
    for (const id of [activeRevoker, disabledPeer]) {
      await pool.query(
        `INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
         VALUES ($1,$2,clock_timestamp(),clock_timestamp())`, [tenant, id],
      );
    }
    await pool.query(
      `INSERT INTO talks.human_dm_contact_requests
         (tenant_id,first_user_id,second_user_id,requested_by,status)
       VALUES ($1,LEAST($2::text,$3::text),GREATEST($2::text,$3::text),
               $2,'accepted')`,
      [tenant, activeRevoker, disabledPeer],
    );

    const repo = createPostgresHumanContactRepository(pool);
    const read = async () => (await pool.query<{
      status: string; revoked_by: string | null; updated_at: string;
    }>(
      `SELECT status, revoked_by, updated_at::text AS updated_at
       FROM talks.human_dm_contact_requests
       WHERE tenant_id=$1 AND first_user_id=LEAST($2::text,$3::text)
         AND second_user_id=GREATEST($2::text,$3::text)`,
      [tenant, activeRevoker, disabledPeer],
    )).rows[0];

    const original = await read();
    expect(original).toMatchObject({ status: "accepted", revoked_by: null });
    await pool.query(
      `UPDATE identity.users SET state='disabled' WHERE tenant_id=$1 AND user_id=$2`,
      [tenant, activeRevoker],
    );
    expect(await repo.revoke({
      tenantId: tenant, actorId: activeRevoker, otherUserId: disabledPeer,
    })).toBe(false);
    expect(await read()).toEqual(original);

    // Recover the actor account but disable the peer: cleanup by the active
    // participant must still work without the peer being able to log in.
    await pool.query(
      `UPDATE identity.users SET state='active' WHERE tenant_id=$1 AND user_id=$2`,
      [tenant, activeRevoker],
    );
    await pool.query(
      `UPDATE identity.users SET state='disabled' WHERE tenant_id=$1 AND user_id=$2`,
      [tenant, disabledPeer],
    );
    expect(await repo.revoke({
      tenantId: tenant, actorId: activeRevoker, otherUserId: disabledPeer,
    })).toBe(true);
    const revoked = await read();
    expect(revoked).toMatchObject({ status: "declined", revoked_by: activeRevoker });
    expect(await repo.revoke({
      tenantId: tenant, actorId: activeRevoker, otherUserId: disabledPeer,
    })).toBe(true);
    expect(await read()).toEqual(revoked);
  });

  it("checks reciprocal block and disabled accounts at authoritative query time", async () => {
    const repo = createPostgresHumanContactRepository(pool);
    await pool.query(
      `INSERT INTO talks.safety_preferences
         (tenant_id,viewer_user_id,subject_user_id,blocked,updated_at)
       VALUES ($1,$2,$3,true,clock_timestamp())`,
      [tenant, bob, alice],
    );
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle }))
      .toBeNull();
    expect(await repo.request({ tenantId: tenant, requesterId: alice, handle: bobHandle }))
      .toBe("unavailable");
    expect(await repo.list({ tenantId: tenant, userId: alice, limit: 30 }))
      .toHaveLength(0);
    await pool.query(
      `DELETE FROM talks.safety_preferences
       WHERE tenant_id=$1 AND viewer_user_id=$2 AND subject_user_id=$3`,
      [tenant, bob, alice],
    );
    await pool.query(
      `UPDATE identity.users SET state='disabled'
       WHERE tenant_id=$1 AND user_id=$2`, [tenant, bob],
    );
    expect(await repo.lookup({ tenantId: tenant, viewerId: alice, handle: bobHandle }))
      .toBeNull();
  });
});
