/** AF09 disposable PostgreSQL schema integration regression.
 * RUN ONLY against an explicitly named disposable _af09_test database.
 * AF00 must install reviewed numbered migration before any non-test use.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.AF09_SCHEMA_TEST_DATABASE_URL;
const allowed = process.env.AF09_SCHEMA_DISPOSABLE === 'yes' &&
  typeof url === 'string' && (() => {
    try { return new URL(url).pathname.endsWith('_af09_test'); }
    catch { return false; }
  })();

async function expectSqlState(client, sql, params, state) {
  await client.query('SAVEPOINT af09_negative');
  await assert.rejects(client.query(sql, params),
    error => error && error.code === state);
  await client.query('ROLLBACK TO SAVEPOINT af09_negative');
  await client.query('RELEASE SAVEPOINT af09_negative');
}

test('AF09 SQL real disposable-DB uniqueness, tenant FK, publication and listen-count contracts',
  { skip: !allowed && 'Requires AF09_SCHEMA_DISPOSABLE=yes and a dedicated *_af09_test PostgreSQL DB' },
  async () => {
    const client = new pg.Client({connectionString:url});
    await client.connect();
    try {
      const schema = await readFile(new URL('./schema.sql',import.meta.url),'utf8');
      // Schema DDL deliberately commits. A never-used disposable database is
      // required; this test does not drop any application schema on teardown.
      await client.query(schema);
      await client.query('BEGIN');
      const insert = `INSERT INTO social.audio_posts
        (tenant_id,post_id,author_id,author_account_id,author_kind,
         asset_id,request_id,title,duration_ms,status,published_at)
        VALUES($1,$2,'alice','alice','human','asset1',$3,'Hello',3000,'published',now())`;
      await client.query(insert,['tenantA','post1','request1']);
      await client.query(insert,['tenantB','post1','request1']);
      await expectSqlState(client,insert,['tenantA','otherPost','request1'],'23505');
      await expectSqlState(client,
        `INSERT INTO social.audio_posts
        (tenant_id,post_id,author_id,author_account_id,author_kind,asset_id,
        request_id,title,duration_ms,status)
        VALUES('tenantA','bad','alice','alice','human','asset2',
        'request2','bad',180001,'processing')`,[], '23514');
      await expectSqlState(client,
        `INSERT INTO social.audio_post_reactions
         (tenant_id,post_id,account_id,kind)
         VALUES('tenantA','missing','viewer1','like')`,[], '23503');
      await client.query(`INSERT INTO social.audio_post_reactions
        (tenant_id,post_id,account_id,kind)
        VALUES ('tenantA','post1','viewer1','save')`);
      await expectSqlState(client,
        `INSERT INTO social.audio_post_reactions
          (tenant_id,post_id,account_id,kind)
          VALUES ('tenantA','post1','viewer1','save')`,[], '23505');
      await client.query(`INSERT INTO social.audio_post_comments
        (tenant_id,post_id,comment_id,author_account_id,request_id,body)
        VALUES('tenantA','post1','comment1','viewer1','c1','Nice')`);
      await expectSqlState(client,
        `INSERT INTO social.audio_post_comments
        (tenant_id,post_id,comment_id,author_account_id,request_id,body)
        VALUES('tenantA','post1','comment2','viewer1','c1','Replay')`,[], '23505');
      await client.query(`UPDATE social.audio_post_comments SET removed=true,body=''
        WHERE tenant_id='tenantA' AND post_id='post1' AND comment_id='comment1'`);
      await client.query(`INSERT INTO social.audio_post_follows
        (tenant_id,follower_account_id,author_id,author_kind)
        VALUES('tenantA','viewer1','alice','human')`);
      await expectSqlState(client,
        `INSERT INTO social.audio_post_follows
        (tenant_id,follower_account_id,author_id,author_kind)
        VALUES('tenantA','viewer1','alice','human')`,[],'23505');
      const grant = await client.query(`INSERT INTO social.audio_post_listen_sessions
        (tenant_id,post_id,viewer_account_id,post_revision,duration_ms)
        VALUES('tenantA','post1','viewer1',0,3000)
        RETURNING listen_id,issued_at,expires_at,accepted,counted`);
      assert.equal(grant.rows.length,1);
      assert.equal(grant.rows[0].accepted,false);
      assert.equal(grant.rows[0].counted,false);
      assert.ok(new Date(grant.rows[0].expires_at) > new Date(grant.rows[0].issued_at));
      const recordDay = `INSERT INTO social.audio_post_listen_days
        (tenant_id,post_id,viewer_account_id,listen_day)
        VALUES('tenantA','post1','viewer1',DATE '2026-10-10')
        ON CONFLICT DO NOTHING RETURNING post_id`;
      assert.equal((await client.query(recordDay)).rowCount,1);
      assert.equal((await client.query(recordDay)).rowCount,0);
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM social.audio_post_listen_days
        WHERE tenant_id='tenantA' AND post_id='post1'`)).rows[0].n,1);
      await expectSqlState(client,
        `INSERT INTO social.audio_post_listen_days
        (tenant_id,post_id,viewer_account_id,listen_day)
        VALUES('tenantB','missing','viewer1',DATE '2026-10-10')`,[],'23503');
    } finally {
      try { await client.query('ROLLBACK'); } finally { await client.end(); }
    }
  });
