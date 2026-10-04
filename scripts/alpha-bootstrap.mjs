import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import {
  characterContextMigrationRoots,
  createPostgresAgentPresentationRepository,
  createPostgresIdentityRepository,
  createPostgresPool,
  runMigrations,
  setPolicyRevision,
  withTransaction,
} from "@masanawa/postgres";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output" || !args[1])) {
  throw new Error("Supported option: --output <private-config-file>");
}
const outputFile = args[1];
if (outputFile && existsSync(outputFile)) throw new Error("Bootstrap output already exists; refusing to seed another Alpha.");

const connectionString =
  process.env.MASANAWA_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("MASANAWA_DATABASE_URL or DATABASE_URL is required");
}

const displayName =
  process.env.MASANAWA_ALPHA_AGENT_NAME?.trim() || "Amina";
const roleLabel =
  process.env.MASANAWA_ALPHA_AGENT_ROLE?.trim() || "General Assistant";
const policyRevision =
  process.env.MASANAWA_ALPHA_POLICY_REVISION?.trim() || "alpha-1";
const devToken =
  process.env.MASANAWA_ALPHA_DEV_TOKEN?.trim() ||
  randomBytes(32).toString("base64url");

const tenantId = createCanonicalId("tenant");
const userId = createCanonicalId("user");
const characterId = createCanonicalId("character");
const characterVersionId = createCanonicalId("character-version");
const relationshipId = createCanonicalId("relationship");
const at = nowInstant();

const pool = createPostgresPool({
  connectionString,
  applicationName: "masanawa-alpha-bootstrap",
});

try {
  const applied = await runMigrations(
    pool,
    characterContextMigrationRoots(),
  );

  await withTransaction(pool, async (client) => {
    const identity = createPostgresIdentityRepository(client);
    await identity.createTenant({ tenantId, createdAt: at });
    await identity.createUser({ tenantId, userId, createdAt: at });
    await identity.createCharacter({
      tenantId,
      characterId,
      createdAt: at,
    });
    await identity.createCharacterVersion({
      tenantId,
      characterVersionId,
      characterId,
      versionNumber: 1,
      constitution: {
        schemaVersion: 1,
        displayName,
        biography: `${displayName} is a Masanawa Alpha development Character.`,
        personality: ["helpful", "clear", "practical"],
        boundaries: [
          "Do not claim capabilities that have not been executed.",
          "Be transparent when Alpha functionality is unavailable.",
        ],
        disclosurePolicy: {},
        languages: ["en"],
        voiceReferences: [],
        appearanceReferences: [],
        expertise: ["general assistance"],
      },
      createdAt: at,
    });
    await identity.publishCharacterVersion({
      tenantId,
      characterVersionId,
      publishedAt: at,
    });
    const character = await identity.activateCharacterVersion({
      tenantId,
      characterId,
      characterVersionId,
      expectedCharacterRevision: 1,
      activatedAt: at,
    });
    if (character.activeCharacterVersionId !== characterVersionId) {
      throw new Error("Alpha Character activation failed");
    }
    await identity.getOrCreateRelationship({
      tenantId,
      relationshipId,
      userId,
      characterId,
      createdAt: at,
    });
    await setPolicyRevision(client, tenantId, policyRevision);
  });

  const presentations = createPostgresAgentPresentationRepository(pool);
  await presentations.put({
    expectedRevision: null,
    presentation: {
      schemaVersion: 1,
      tenantId,
      characterId,
      characterVersionId,
      displayName,
      roleLabel,
      about: "Development Character for testing Masanawa from the mobile app.",
      greeting: `Hi, I’m ${displayName}. What should we work on?`,
      visibleInUserApp: true,
      sortOrder: 0,
      revision: 1,
    },
  });

  const relationshipMap = JSON.stringify({
    [characterId]: relationshipId,
  });

  if (outputFile) {
    writeFileSync(outputFile, JSON.stringify({
      MASANAWA_ALPHA_ENABLED: "true",
      MASANAWA_ALPHA_DEV_TOKEN: devToken,
      MASANAWA_ALPHA_TENANT_ID: tenantId,
      MASANAWA_ALPHA_USER_ID: userId,
      MASANAWA_ALPHA_POLICY_REVISION: policyRevision,
      MASANAWA_ALPHA_RELATIONSHIPS_JSON: relationshipMap,
    }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    process.stdout.write(`Hosted Alpha config written privately. Seeded Character: ${displayName} / ${characterId}\n`);
  } else process.stdout.write(
    [
      "",
      "Masanawa Alpha bootstrap complete.",
      applied.length
        ? `Applied migrations: ${applied.join(", ")}`
        : "Migrations were already current.",
      "",
      "Gateway environment:",
      "MASANAWA_ALPHA_ENABLED=true",
      `MASANAWA_ALPHA_DEV_TOKEN=${devToken}`,
      `MASANAWA_ALPHA_TENANT_ID=${tenantId}`,
      `MASANAWA_ALPHA_USER_ID=${userId}`,
      `MASANAWA_ALPHA_POLICY_REVISION=${policyRevision}`,
      `MASANAWA_ALPHA_RELATIONSHIPS_JSON='${relationshipMap}'`,
      "MASANAWA_ALPHA_GEMINI_API_KEY=<your-dev-key>",
      "MASANAWA_ALPHA_GEMINI_MODEL=<model-name>",
      "",
      "Mobile build defines:",
      "AGENT_RUNTIME_ENABLED=true",
      "AGENT_BASE_URL=<your-dev-gateway-url>",
      `ALPHA_DEV_ACCESS_TOKEN=${devToken}`,
      "",
      `Seeded Character: ${displayName} / ${characterId}`,
      `CharacterVersion: ${characterVersionId}`,
      `Relationship: ${relationshipId}`,
      "",
    ].join("\n"),
  );
} finally {
  await pool.end();
}
