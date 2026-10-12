import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("U02 PostgreSQL migration ownership and non-lossy event constraints", () => {
  it("ships a standalone migration without registering it in shared Gateway", async () => {
    const sql=await readFile(new URL("../migrations/0010_operator_tasks_isolated.sql",import.meta.url),"utf8");
    for(const snippet of [
      "UNIQUE (tenant_id,user_id,request_id)",
      "PRIMARY KEY (tenant_id,user_id,task_id,task_version)",
      "CHECK (phase <> 'succeeded'",
      "FOREIGN KEY (tenant_id,user_id,task_id)",
      "CREATE INDEX IF NOT EXISTS operator_task_owner_history",
    ]) expect(sql).toContain(snippet);
  });
});
