import { createHash, randomBytes } from "node:crypto";
import { assertAlphaBootstrapTarget } from "./alpha-bootstrap-safety.mjs";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  nowInstant,
} from "@masanawa/contracts";
import {
  platformProductMigrationRoots,
  createPostgresAgentPresentationRepository,
  createPostgresCharacterSkillAssignmentRepository,
  createPostgresCommerceRepository,
  createPostgresIdentityRepository,
  createPostgresPlatformAgentProfileRepository,
  createPostgresPool,
  createPostgresSkillGuideRepository,
  createPostgresSkillDistributionRepository,
  createPostgresSkillRepository,
  createPostgresUserAgentPreferenceRepository,
  runMigrations,
  setPolicyRevision,
  withTransaction,
} from "@masanawa/postgres";

// This entry point creates DEMO identities; reject production or ambiguous DBs
// before opening a Pool or running any schema/data mutation.
assertAlphaBootstrapTarget(process.env);

const connectionString =
  process.env.MASANAWA_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("MASANAWA_DATABASE_URL or DATABASE_URL is required");
}

const policyRevision =
  process.env.MASANAWA_ALPHA_POLICY_REVISION?.trim() || "alpha-1";
const devToken =
  process.env.MASANAWA_ALPHA_DEV_TOKEN?.trim() ||
  randomBytes(32).toString("base64url");

const tenantId = createCanonicalId("tenant");
const userId = createCanonicalId("user");
const at = nowInstant();

const pool = createPostgresPool({
  connectionString,
  applicationName: "masanawa-alpha-bootstrap",
});

function hash(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function certification(skillVersionId, key) {
  const activationRef = `rehearsal://alpha/${key}/activation`;
  const negativeRef = `rehearsal://alpha/${key}/negative`;
  return {
    subjectSkillVersionId: skillVersionId,
    profile: "alpha-support",
    suiteKey: "skills.alpha-support",
    suiteRevision: "2026.10.04",
    suiteContentHash: hash(`${key}:suite:2026.10.04`),
    certifiedAt: at,
    certifierKey: "masanawa.alpha-bootstrap",
    cases: [
      {
        caseKey: "activation.basic",
        kind: "activation",
        outcome: "passed",
        observedAt: at,
        evidenceRef: activationRef,
        evidenceHash: hash(activationRef),
      },
      {
        caseKey: "negative.basic",
        kind: "negative-activation",
        outcome: "passed",
        observedAt: at,
        evidenceRef: negativeRef,
        evidenceHash: hash(negativeRef),
      },
    ],
    testCaseCount: 2,
    passedTestCaseCount: 2,
  };
}

function authoredSkill({
  key,
  displayName,
  description,
  activationExamples,
  negativeActivationExamples,
  capability,
  guide,
  discovery,
  billingMode = "none",
}) {
  const skillId = createCanonicalId("skill");
  const skillVersionId = createCanonicalId("skill-version");
  const source = `masanawa://skills/${key}/1.0.0`;
  return {
    version: {
      skillId,
      skillVersionId,
      key,
      version: "1.0.0",
      displayName,
      description,
      activationExamples,
      negativeActivationExamples,
      capabilities: [normalizeCapabilityKey(capability)],
      requiredToolCapabilities: [],
      toolReferences: [],
      requiredAuthorityCapabilities: [],
      dependencies: [],
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      visibility: "model-visible",
      riskClass: "read-only",
      sideEffectClass: "none",
      sensitivity: "internal",
      costClass: "free",
      billingMode,
      confirmationPolicy:
        billingMode === "none" ? "not-required" : "required",
      idempotencyMode: "not-required",
      reconciliationMode: "none",
      timeoutMs: 30_000,
      provenance: {
        sourceKind: "authored",
        sourceSystem: "masanawa",
        sourceReference: source,
        sourceRevision: "1.0.0",
        sourceContentHash: hash(source),
        publisher: {
          publisherKey: "masanawa",
          displayName: "Masanawa",
          kind: "first-party",
          reference: null,
        },
        trust: {
          tier: "first-party",
          evaluatorKey: "masanawa.alpha-bootstrap",
          evaluatedAt: at,
          reasonCodes: ["publisher.first-party"],
        },
      },
      certification: certification(skillVersionId, key),
    },
    guide: {
      schemaVersion: 1,
      skillVersionId,
      triggerDescription: guide.triggerDescription,
      instructions: guide.instructions,
      resources: [],
      discovery: {
        priority: discovery.priority,
        phrases: discovery.phrases,
        allOf: discovery.allOf,
        anyOf: discovery.anyOf,
        noneOf: discovery.noneOf,
        minScore: discovery.minScore,
      },
    },
  };
}

const supportSkills = [
  authoredSkill({
    key: "masanawa.clone-setup",
    displayName: "Clone setup",
    description: "Guides a nontechnical user through creating and improving one personal Masanawa clone.",
    activationExamples: [
      "Help me create my clone",
      "I want to improve my digital twin",
    ],
    negativeActivationExamples: [
      "Do not change my clone",
      "I only want to chat",
    ],
    capability: "masanawa.clone.setup",
    guide: {
      triggerDescription:
        "Use when a user wants to create, configure, improve, or understand their personal Masanawa clone.",
      instructions: [
        "# Clone setup",
        "Help the user describe themselves in ordinary language rather than exposing prompts, models, Tools, or provider settings.",
        "Infer a concise proposed profile: name, languages, communication style, interests/expertise, discoverability preference, and useful Skills.",
        "Keep the one-person-one-personal-clone rule explicit.",
        "Do not claim a clone was created, changed, published, or connected unless the runtime returns evidence of that mutation.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 90,
      phrases: ["create my clone", "my digital twin", "improve my clone"],
      allOf: [["create", "clone"], ["configure", "clone"]],
      anyOf: ["clone", "twin", "profile"],
      noneOf: ["do not change my clone"],
      minScore: 20,
    },
  }),
  authoredSkill({
    key: "masanawa.product-discovery",
    displayName: "Product and service discovery",
    description: "Helps users find the Masanawa products, services, and Skills that fit their goal.",
    activationExamples: [
      "What can Masanawa help me buy?",
      "Which service can help me with this?",
    ],
    negativeActivationExamples: [
      "I already know the exact service I want",
      "Do not recommend anything",
    ],
    capability: "masanawa.product.discover",
    guide: {
      triggerDescription:
        "Use when a user needs help deciding which Masanawa product, service, or Skill can satisfy a goal.",
      instructions: [
        "# Product and service discovery",
        "Start from the user's outcome, not from a feature dump.",
        "Recommend the smallest relevant set of available products or Skills and explain the practical result each provides.",
        "Never invent price, availability, commission, provider readiness, or fulfillment guarantees; those come from canonical Offer/runtime data.",
        "When no matching product is evidenced by the runtime, say so plainly and continue helping conversationally where possible.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 80,
      phrases: ["what can masanawa do", "which service", "what can i buy"],
      allOf: [["help", "service"], ["need", "product"]],
      anyOf: ["service", "product", "skill", "buy", "order"],
      noneOf: ["do not recommend"],
      minScore: 20,
    },
  }),
  authoredSkill({
    key: "masanawa.creator-guidance",
    displayName: "Creator guidance",
    description: "Helps clone creators improve customer relationships, Skill selection, Float readiness, and distribution.",
    activationExamples: [
      "How can my clone earn more?",
      "Which skills should I add to my clone?",
    ],
    negativeActivationExamples: [
      "I am not asking about my clone",
      "Do not discuss earnings",
    ],
    capability: "masanawa.creator.guide",
    guide: {
      triggerDescription:
        "Use when a clone creator asks how to improve, market, fund, or monetize their personal clone.",
      instructions: [
        "# Creator guidance",
        "Optimize for customer usefulness and repeat relationships before revenue.",
        "Explain Skill selection in simple product language; hide internal SkillVersion, Tool, Provider, and routing details unless the user explicitly needs technical diagnostics.",
        "Explain Agent Float as non-withdrawable execution capacity, distinct from withdrawable earnings.",
        "Never promise earnings, fabricate balances, or invent commission rates. Use canonical Commerce data when available.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 85,
      phrases: ["my clone earn", "skills should i add", "agent float"],
      allOf: [["clone", "earn"], ["clone", "market"]],
      anyOf: ["creator", "earnings", "float", "commission", "referral"],
      noneOf: ["do not discuss earnings"],
      minScore: 20,
    },
  }),
];

const personalSkills = [
  authoredSkill({
    key: "business.plan",
    displayName: "Business Planning",
    description:
      "Turns a business idea or existing business problem into a practical structured plan.",
    activationExamples: [
      "Help me create a business plan",
      "Plan how I can launch this business",
    ],
    negativeActivationExamples: [
      "Do not make a business plan",
      "I only want a quick definition",
    ],
    capability: "business.plan.draft",
    guide: {
      triggerDescription:
        "Use when the user wants to plan, improve, validate, or structure a business or commercial idea.",
      instructions: [
        "# Business Planning",
        "Start from the user's actual goal, market, resources, constraints, and current stage.",
        "Produce practical decisions rather than generic entrepreneurship advice.",
        "When information is missing, make clearly labeled assumptions instead of inventing facts.",
        "Structure the result around customer, value proposition, offer, acquisition, operations, costs, revenue, risks, and next actions when those sections are relevant.",
        "Do not claim current market facts or competitor research unless a Tool or runtime evidence actually supplied them.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 75,
      phrases: ["business plan", "plan my business", "business idea"],
      allOf: [["start", "business"], ["improve", "business"]],
      anyOf: ["business", "startup", "revenue", "customer", "market"],
      noneOf: ["do not make a business plan"],
      minScore: 20,
    },
  }),
  authoredSkill({
    key: "documents.cv-draft",
    displayName: "CV Drafting",
    description:
      "Produces and improves clear CV or résumé content from information the user provides.",
    activationExamples: [
      "Write my CV",
      "Improve my resume",
    ],
    negativeActivationExamples: [
      "Do not edit my CV",
      "I am not asking for a resume",
    ],
    capability: "documents.cv.draft",
    guide: {
      triggerDescription:
        "Use when the user wants to create, rewrite, improve, or tailor CV or résumé content.",
      instructions: [
        "# CV Drafting",
        "Use only facts supplied by the user or present in authorized context.",
        "Never invent employers, qualifications, dates, achievements, metrics, or references.",
        "Prioritize concise evidence-based accomplishment language and a structure appropriate to the target role.",
        "Ask for missing critical facts only when the output would otherwise be misleading; otherwise provide a clearly marked draft with placeholders.",
        "Do not claim a PDF/DOCX file was generated unless a file-generation Tool actually produced it.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 80,
      phrases: ["write my cv", "improve my resume", "tailor my cv"],
      allOf: [["cv", "job"], ["resume", "job"]],
      anyOf: ["cv", "resume", "résumé", "experience"],
      noneOf: ["do not edit my cv"],
      minScore: 20,
    },
  }),
  authoredSkill({
    key: "content.social-draft",
    displayName: "Social Content Drafting",
    description:
      "Drafts platform-appropriate social posts and content ideas without pretending they were published.",
    activationExamples: [
      "Write a Facebook post for me",
      "Create social media content",
    ],
    negativeActivationExamples: [
      "Do not write a social post",
      "Publish this exact post without changes",
    ],
    capability: "content.social.draft",
    guide: {
      triggerDescription:
        "Use when the user wants to draft, rewrite, adapt, or brainstorm social-media content.",
      instructions: [
        "# Social Content Drafting",
        "Match the audience, platform, language, tone, and objective the user provides.",
        "Keep claims grounded in supplied context and avoid fabricating fresh facts, results, endorsements, or testimonials.",
        "Return publish-ready copy when enough context exists; otherwise make assumptions explicit.",
        "Drafting is not publishing. Never say content was posted, scheduled, or sent unless an authorized Tool returns evidence.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 70,
      phrases: ["facebook post", "social media content", "write a post"],
      allOf: [["write", "post"], ["create", "content"]],
      anyOf: ["facebook", "instagram", "linkedin", "social", "caption", "post"],
      noneOf: ["do not write a social post"],
      minScore: 20,
    },
  }),
];

const paidSkills = [
  authoredSkill({
    key: "services.business-plan",
    displayName: "Business Plan Service",
    description:
      "Produces a structured business plan as a paid Masanawa service after an approved quote.",
    activationExamples: [
      "Create a full business plan for me",
      "I want to order a business plan",
    ],
    negativeActivationExamples: [
      "I only want a quick business idea",
      "Do not charge me for a business plan",
    ],
    capability: "services.business-plan.fulfill",
    billingMode: "quoted",
    guide: {
      triggerDescription:
        "Use only inside an admitted paid fulfillment when the customer ordered the Business Plan Service.",
      instructions: [
        "# Paid Business Plan Service",
        "This Skill is executed only after a canonical Masanawa quote and fulfillment admission.",
        "Build a professional plan from the customer's supplied facts and authorized context.",
        "Cover executive summary, customer/problem, offer, market assumptions, acquisition, operations, revenue model, costs, risks, milestones, and next actions when relevant.",
        "Clearly label assumptions and never fabricate current market research, financial history, customers, partners, licenses, or external validation.",
        "The result must be substantially more complete than ordinary conversational brainstorming.",
      ].join("\n\n"),
    },
    discovery: {
      priority: 95,
      phrases: ["order a business plan", "paid business plan", "full business plan"],
      allOf: [["business", "plan", "order"]],
      anyOf: ["business plan", "proposal"],
      noneOf: ["do not charge me"],
      minScore: 25,
    },
  }),
];

const characters = [
  {
    key: "gwani",
    displayName: "Gwani",
    voiceName: "Bodi",
    defaultForNewUsers: true,
  },
  {
    key: "gwana",
    displayName: "Gwana",
    voiceName: "Sulafat",
    defaultForNewUsers: false,
  },
].map((config, index) => ({
  ...config,
  characterId: createCanonicalId("character"),
  characterVersionId: createCanonicalId("character-version"),
  relationshipId: createCanonicalId("relationship"),
  sortOrder: index,
}));

try {
  const applied = await runMigrations(
    pool,
    platformProductMigrationRoots(),
  );

  await withTransaction(pool, async (client) => {
    const identity = createPostgresIdentityRepository(client);
    await identity.createTenant({ tenantId, createdAt: at });
    await identity.createUser({ tenantId, userId, createdAt: at });

    for (const [index, item] of paidSkills.entries()) {
    await distribution.put({
      schemaVersion: 1,
      skillVersionId: item.version.skillVersionId,
      audiences: ["personal-clone", "platform-support"],
      installMode: "optional",
      category: "business-services",
      sortOrder: 100 + index,
    });
  }

  for (const character of characters) {
      await identity.createCharacter({
        tenantId,
        characterId: character.characterId,
        createdAt: at,
      });
      await identity.assignCharacterOwnership({
        tenantId,
        characterId: character.characterId,
        kind: "platform",
        ownerUserId: null,
        createdAt: at,
      });
      await identity.createCharacterVersion({
        tenantId,
        characterVersionId: character.characterVersionId,
        characterId: character.characterId,
        versionNumber: 1,
        constitution: {
          schemaVersion: 1,
          displayName: character.displayName,
          biography: `${character.displayName} is a Masanawa platform support Character.`,
          personality: ["helpful", "clear", "practical", "respectful"],
          boundaries: [
            "Do not claim capabilities or completed actions without runtime evidence.",
            "Do not invent prices, balances, earnings, availability, or fulfillment status.",
            "Treat support, onboarding, creator guidance, and product discovery as the same peer platform role.",
          ],
          disclosurePolicy: {},
          languages: ["en", "ha"],
          voiceReferences: [],
          appearanceReferences: [],
          expertise: [
            "Masanawa onboarding",
            "creator guidance",
            "product and service discovery",
            "platform support",
          ],
        },
        createdAt: at,
      });
      await identity.publishCharacterVersion({
        tenantId,
        characterVersionId: character.characterVersionId,
        publishedAt: at,
      });
      await identity.activateCharacterVersion({
        tenantId,
        characterId: character.characterId,
        characterVersionId: character.characterVersionId,
        expectedCharacterRevision: 1,
        activatedAt: at,
      });
      await identity.getOrCreateRelationship({
        tenantId,
        relationshipId: character.relationshipId,
        userId,
        characterId: character.characterId,
        createdAt: at,
      });
    }
    await setPolicyRevision(client, tenantId, policyRevision);
  });

  const skills = createPostgresSkillRepository(pool);
  const guides = createPostgresSkillGuideRepository(pool);
  const distribution = createPostgresSkillDistributionRepository(pool);
  const skillAssignments =
    createPostgresCharacterSkillAssignmentRepository(pool);
  const presentations = createPostgresAgentPresentationRepository(pool);
  const profiles = createPostgresPlatformAgentProfileRepository(pool);
  const preferences = createPostgresUserAgentPreferenceRepository(pool);
  const commerce = createPostgresCommerceRepository(pool);

  const allSkills = [...supportSkills, ...personalSkills, ...paidSkills];
  await skills.registerBatch(allSkills.map((item) => item.version));
  for (const item of allSkills) {
    await guides.putGuide(item.guide);
    await skills.putReadiness({
      expectedRevision: null,
      readiness: {
        skillVersionId: item.version.skillVersionId,
        state: "ready",
        advertised: true,
        reasonCode: null,
        checkedAt: at,
      },
    });
  }

  for (const [index, item] of supportSkills.entries()) {
    await distribution.put({
      schemaVersion: 1,
      skillVersionId: item.version.skillVersionId,
      audiences: ["platform-support"],
      installMode: "automatic",
      category: "masanawa-support",
      sortOrder: index,
    });
  }
  for (const [index, item] of personalSkills.entries()) {
    await distribution.put({
      schemaVersion: 1,
      skillVersionId: item.version.skillVersionId,
      audiences: ["personal-clone"],
      installMode: "optional",
      category: "productivity",
      sortOrder: index,
    });
  }

  for (const character of characters) {
    await presentations.put({
      expectedRevision: null,
      presentation: {
        schemaVersion: 1,
        tenantId,
        characterId: character.characterId,
        characterVersionId: character.characterVersionId,
        displayName: character.displayName,
        roleLabel: "Masanawa Support",
        about:
          "Onboarding, platform support, creator guidance, and product/service discovery.",
        greeting: `Hi, I’m ${character.displayName}. What would you like to do on Masanawa?`,
        visibleInUserApp: true,
        sortOrder: character.sortOrder,
        revision: 1,
      },
    });
    await profiles.put({
      expectedRevision: null,
      profile: {
        schemaVersion: 1,
        tenantId,
        characterId: character.characterId,
        supportAgent: true,
        defaultForNewUsers: character.defaultForNewUsers,
        voiceProvider: "gemini",
        voiceName: character.voiceName,
        revision: 1,
      },
    });
    await skillAssignments.put({
      expectedRevision: null,
      assignment: {
        schemaVersion: 1,
        tenantId,
        characterId: character.characterId,
        skillVersionIds: [...supportSkills, ...paidSkills].map(
          (item) => item.version.skillVersionId,
        ),
        revision: 1,
      },
    });
  }

  const businessPlanSkill = paidSkills.find(
    (item) => item.version.key === "services.business-plan",
  );
  if (!businessPlanSkill) throw new Error("Business Plan Skill seed is missing");
  const businessPlanOfferId = createCanonicalId("offer");
  await commerce.registerOfferRevision({
    schemaVersion: 1,
    tenantId,
    offerId: businessPlanOfferId,
    revision: 1,
    key: "business-plan.standard",
    title: "Business Plan",
    description:
      "A structured business plan prepared through a Masanawa agent after quote approval.",
    skillVersionId: businessPlanSkill.version.skillVersionId,
    priceCredits: 100,
    fulfillmentReserveCredits: 50,
    creatorCommissionCredits: 30,
    fallbackCommissionCredits: 10,
    platformMarginCredits: 20,
    active: true,
    regions: [],
    createdAt: at,
  });

  await commerce.postTransfer({
    schemaVersion: 1,
    ledgerEntryId: createCanonicalId("ledger-entry"),
    tenantId,
    debit: {
      tenantId,
      kind: "external-clearing",
      userId: null,
      characterId: null,
    },
    credit: {
      tenantId,
      kind: "customer-credit",
      userId,
      characterId: null,
    },
    amountCredits: 1000,
    reason: "customer-topup",
    quoteId: null,
    fulfillmentId: null,
    createdAt: at,
  });

  const gwani = characters.find((item) => item.key === "gwani");
  if (!gwani) throw new Error("Gwani seed is missing");
  await preferences.put({
    expectedRevision: null,
    preference: {
      schemaVersion: 1,
      tenantId,
      userId,
      defaultPlatformCharacterId: gwani.characterId,
      revision: 1,
    },
  });

  const relationshipMap = JSON.stringify(
    Object.fromEntries(
      characters.map((character) => [
        character.characterId,
        character.relationshipId,
      ]),
    ),
  );

  process.stdout.write(
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
      ...characters.flatMap((character) => [
        `Seeded Character: ${character.displayName} / ${character.characterId}`,
        `CharacterVersion: ${character.characterVersionId}`,
        `Relationship: ${character.relationshipId}`,
        `Voice: Gemini ${character.voiceName}`,
      ]),
      "",
      `Default support Character: Gwani / ${gwani.characterId}`,
      "Seeded development Credits: 1000",
      `Assigned support Skills: ${supportSkills
        .map((item) => item.version.key)
        .join(", ")}`,
      `Optional personal-clone Skills: ${[...personalSkills, ...paidSkills]
        .map((item) => item.version.key)
        .join(", ")}`,
      "Seeded paid Offer: business-plan.standard / 100 Credits",
      "",
    ].join("\n"),
  );
} finally {
  await pool.end();
}
