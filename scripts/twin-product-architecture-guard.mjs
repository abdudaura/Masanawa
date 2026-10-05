const forbiddenTopLevelPatterns = [
  /^packages\/(?:wallet|marketplace|clone-runtime|social)(?:\/|$)/,
  /^services\/(?:wallet|marketplace|clone-runtime|social)(?:\/|$)/,
];

const forbiddenSocialScreenPatterns = [
  /^apps\/mobile\/lib\/src\/screens\/(?:feed|social|posts|followers|likes)(?:\/|$)/,
];

const consumerSurfacePatterns = [
  /^apps\/mobile\/lib\/src\/screens\/twin\//,
  /^apps\/mobile\/lib\/src\/screens\/explore\//,
  /^apps\/mobile\/lib\/src\/screens\/activity\//,
  /^apps\/mobile\/lib\/src\/screens\/wallet\//,
  /^apps\/mobile\/lib\/src\/agents\/twin_/,
  /^apps\/mobile\/lib\/src\/commerce\/wallet_/,
];

const forbiddenConsumerTerms = [
  { pattern: /\bAgent Float\b/i, label: "Agent Float" },
  { pattern: /\bSkillVersion\b/, label: "SkillVersion" },
  { pattern: /\bCharacterVersion\b/, label: "CharacterVersion" },
  { pattern: /\bWorkflow(?:Run)?\b/, label: "Workflow" },
  { pattern: /\bProvider(?:Ref)?\b/, label: "Provider" },
];

export function validateTwinProductChanges(changes) {
  const violations = [];

  for (const change of changes) {
    const path = String(change.path ?? "").replace(/\\/g, "/");
    const content = typeof change.content === "string" ? change.content : "";

    for (const pattern of forbiddenTopLevelPatterns) {
      if (pattern.test(path)) {
        violations.push({
          path,
          rule: "no-parallel-product-subsystem",
          message:
            "Do not create a second wallet, marketplace, clone runtime, or social package/service. Reuse canonical Masanawa owners.",
        });
        break;
      }
    }

    for (const pattern of forbiddenSocialScreenPatterns) {
      if (pattern.test(path)) {
        violations.push({
          path,
          rule: "no-human-social-feed",
          message:
            "Masanawa Explore is a twin directory, not a human post/feed/follower/like system.",
        });
        break;
      }
    }

    if (consumerSurfacePatterns.some((pattern) => pattern.test(path))) {
      for (const term of forbiddenConsumerTerms) {
        if (term.pattern.test(content)) {
          violations.push({
            path,
            rule: "hide-internal-product-terms",
            message:
              `Do not expose internal term "${term.label}" in My Twin, Explore, Activity, or Wallet consumer surfaces.`,
          });
        }
      }
    }
  }

  return violations;
}

export function assertTwinProductChanges(changes) {
  const violations = validateTwinProductChanges(changes);
  if (violations.length === 0) return;

  const lines = violations.map(
    (violation) =>
      `- [${violation.rule}] ${violation.path}: ${violation.message}`,
  );
  throw new Error(
    [
      "Twin product architecture guard failed.",
      "Read docs/PRODUCT-TWIN-ECONOMY.md and docs/TWIN-TRANSFORMATION-MASTER-PLAN.md.",
      ...lines,
    ].join("\n"),
  );
}

function parseCliInput(raw) {
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) {
    throw new TypeError(
      "Expected a JSON array of {path, content} changed-file objects.",
    );
  }
  return value;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    try {
      assertTwinProductChanges(parseCliInput(raw));
      process.stdout.write("Twin product architecture guard passed.\n");
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    }
  });
}
