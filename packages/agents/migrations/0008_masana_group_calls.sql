-- Private informational group ownership. No provider secrets or billing authority.
CREATE TABLE agents.masana_call_groups (
 tenant_id text NOT NULL, user_id text NOT NULL, group_id uuid NOT NULL,
 request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
 selected_ids text[] NOT NULL CHECK (cardinality(selected_ids) BETWEEN 2 AND 4),
 created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), ended_at timestamptz(3),
 PRIMARY KEY (tenant_id,user_id,group_id), UNIQUE (tenant_id,user_id,request_id)
);
CREATE TABLE agents.masana_call_group_participants (
 tenant_id text NOT NULL,user_id text NOT NULL,group_id uuid NOT NULL,
 character_id text NOT NULL,display_name text NOT NULL,
 left_at timestamptz(3),call_id uuid,
 PRIMARY KEY (tenant_id,user_id,group_id,character_id),
 UNIQUE (tenant_id,user_id,call_id),
 FOREIGN KEY (tenant_id,user_id,group_id) REFERENCES agents.masana_call_groups,
 FOREIGN KEY (tenant_id,user_id,call_id) REFERENCES agents.masana_call_history
);
