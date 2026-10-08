/** First-run policy provisioning; call inside the startup transaction. */
export interface PolicyBootstrapClient {
  query(text: string, values: unknown[]): Promise<{ rows: readonly { revision: string }[] }>;
}
export async function initializePostgresPolicyRevision(
  client: PolicyBootstrapClient, tenantId: string, revision: string,
): Promise<void> {
  if (!tenantId.trim() || !revision.trim() || revision.length > 160) {
    throw new TypeError("Platform policy bootstrap identity or revision is invalid");
  }
  await client.query(
    "INSERT INTO security.policy_state (tenant_id, revision) VALUES ($1, $2) " +
    "ON CONFLICT (tenant_id) DO NOTHING",
    [tenantId, revision],
  );
  const result = await client.query(
    "SELECT revision FROM security.policy_state WHERE tenant_id = $1 FOR SHARE",
    [tenantId],
  );
  if (result.rows[0]?.revision !== revision) {
    // Startup must not roll back a newer policy, or bypass current-authority checks.
    throw new Error("platform.policy_revision_mismatch");
  }
}
