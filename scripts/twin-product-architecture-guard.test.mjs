import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTwinProductChanges,
  validateTwinProductChanges,
} from "./twin-product-architecture-guard.mjs";

test("allows the approved four consumer surfaces", () => {
  const violations = validateTwinProductChanges([
    {
      path: "apps/mobile/lib/src/screens/twin/my_twin_screen.dart",
      content: "Create your twin. Talk. Teach. Share.",
    },
    {
      path: "apps/mobile/lib/src/screens/explore/explore_screen.dart",
      content: "Search public twins and open a conversation.",
    },
    {
      path: "apps/mobile/lib/src/screens/activity/activity_screen.dart",
      content: "Visitors, chats, gifts and earnings.",
    },
    {
      path: "apps/mobile/lib/src/screens/wallet/wallet_screen.dart",
      content: "Spendable Credits, Pending Earnings, Available Earnings.",
    },
  ]);

  assert.deepEqual(violations, []);
});

test("rejects a new human social feed surface", () => {
  const violations = validateTwinProductChanges([
    {
      path: "apps/mobile/lib/src/screens/feed/feed_screen.dart",
      content: "Posts and likes",
    },
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "no-human-social-feed");
});

test("rejects a second wallet or marketplace package", () => {
  const violations = validateTwinProductChanges([
    { path: "packages/wallet/src/index.ts", content: "" },
    { path: "services/marketplace/src/main.ts", content: "" },
  ]);

  assert.equal(
    violations.filter((item) => item.rule === "no-parallel-product-subsystem")
      .length,
    2,
  );
});

test("rejects internal terms in new consumer surfaces", () => {
  const violations = validateTwinProductChanges([
    {
      path: "apps/mobile/lib/src/screens/wallet/wallet_screen.dart",
      content: "Agent Float and ProviderRef",
    },
    {
      path: "apps/mobile/lib/src/screens/twin/my_twin_screen.dart",
      content: "CharacterVersion SkillVersion WorkflowRun",
    },
  ]);

  assert.ok(
    violations.some(
      (item) =>
        item.rule === "hide-internal-product-terms" &&
        item.message.includes("Agent Float"),
    ),
  );
  assert.ok(
    violations.some(
      (item) =>
        item.rule === "hide-internal-product-terms" &&
        item.message.includes("CharacterVersion"),
    ),
  );
});

test("assert helper throws a readable error", () => {
  assert.throws(
    () =>
      assertTwinProductChanges([
        {
          path: "services/social/src/main.ts",
          content: "",
        },
      ]),
    /Twin product architecture guard failed/,
  );
});
