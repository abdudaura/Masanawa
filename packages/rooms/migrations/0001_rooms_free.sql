-- L-ROOMS/free. Forward-only SOURCE; AF00 must register in canonical migration registry.
-- Depends on identity/0001; protects historical membership and question rows.
CREATE SCHEMA IF NOT EXISTS rooms;
CREATE TABLE rooms.rooms (
 tenant_id text NOT NULL, room_id text NOT NULL CHECK(room_id ~ '^room_'),
 slug text NOT NULL CHECK(slug ~ '^[a-z0-9-]{3,90}$'),
 profession_title text NOT NULL CHECK(length(btrim(profession_title)) BETWEEN 3 AND 140),
 teacher_character_id text NOT NULL, language text NOT NULL DEFAULT 'en',
 plan_mode text NOT NULL DEFAULT 'free' CHECK(plan_mode IN ('free','paid')),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','paused','retired')),
 rules text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,room_id),
 UNIQUE(tenant_id,slug), FOREIGN KEY(tenant_id,teacher_character_id)
 REFERENCES identity.characters(tenant_id,character_id)
);
CREATE INDEX rooms_discover_idx ON rooms.rooms(tenant_id,language,profession_title)
 WHERE state='published';
CREATE TABLE rooms.memberships (
 tenant_id text NOT NULL, room_id text NOT NULL, user_id text NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','left','banned')),
 joined_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,room_id,user_id),
 FOREIGN KEY(tenant_id,room_id) REFERENCES rooms.rooms(tenant_id,room_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id)
);
CREATE INDEX rooms_member_idx ON rooms.memberships(tenant_id,user_id,room_id) WHERE state='active';
CREATE TABLE rooms.questions (
 tenant_id text NOT NULL, question_id text NOT NULL CHECK(question_id ~ '^room-question_'),
 room_id text NOT NULL, user_id text NOT NULL, body text NOT NULL CHECK(length(btrim(body)) BETWEEN 4 AND 2000),
 idempotency_key text NOT NULL, state text NOT NULL DEFAULT 'queued'
 CHECK(state IN ('queued','answering','needs_staff','answered','rejected')),
 queued_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,question_id),
 UNIQUE(tenant_id,room_id,user_id,idempotency_key),
 FOREIGN KEY(tenant_id,room_id,user_id) REFERENCES rooms.memberships(tenant_id,room_id,user_id)
);
CREATE INDEX rooms_questions_queue ON rooms.questions(tenant_id,room_id,state,queued_at,question_id);
CREATE TABLE rooms.answers (
 tenant_id text NOT NULL, answer_id text NOT NULL CHECK(answer_id ~ '^room-answer_'),
 question_id text NOT NULL, teacher_character_id text NOT NULL,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 6000),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','approved','rejected')),
 reviewed_by text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,answer_id), UNIQUE(tenant_id,question_id),
 FOREIGN KEY(tenant_id,question_id) REFERENCES rooms.questions(tenant_id,question_id),
 FOREIGN KEY(tenant_id,teacher_character_id) REFERENCES identity.characters(tenant_id,character_id),
 CHECK(state<>'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE rooms.lessons (
 tenant_id text NOT NULL,lesson_id text NOT NULL,room_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('lesson','announcement')),
 body text NOT NULL,state text NOT NULL DEFAULT 'draft'
 CHECK(state IN ('draft','published','retired')),
 publish_at timestamptz,PRIMARY KEY(tenant_id,lesson_id),
 FOREIGN KEY(tenant_id,room_id) REFERENCES rooms.rooms(tenant_id,room_id)
);
CREATE TABLE rooms.discussion_replies (
 tenant_id text NOT NULL,reply_id text NOT NULL,room_id text NOT NULL,user_id text NOT NULL,
 question_id text NOT NULL,body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),
 moderation_state text NOT NULL DEFAULT 'held'
 CHECK(moderation_state IN ('held','visible','hidden','removed')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,reply_id),
 FOREIGN KEY(tenant_id,question_id) REFERENCES rooms.questions(tenant_id,question_id),
 FOREIGN KEY(tenant_id,room_id,user_id) REFERENCES rooms.memberships(tenant_id,room_id,user_id)
);
-- Never create entitlements from client claims; paid plans need separately verified Play receipts.
