import assert from "node:assert/strict";
import test from "node:test";
import {
  qualifyTask130Evidence,
  REQUIRED_AGENT_PHONE_SCENARIOS,
} from "./task130-agent-phone-qualification.mjs";

const git = (c) => c.repeat(40);
const hash = (c) => c.repeat(64);

function passingEvidence() {
  return {
    schemaVersion: 1,
    candidateBuildId: "agent-phone-candidate-a",
    deviceModel: "TECNO BF7",
    deviceBuildId: "bf7-build-001",
    environmentClass: "physical-device",
    startedAt: "2026-10-06T12:00:00.000Z",
    completedAt: "2026-10-06T13:00:00.000Z",
    presenceHead: git("a"),
    deviceHead: git("b"),
    omniSipHead: git("c"),
    routingHead: git("d"),
    scenarios: REQUIRED_AGENT_PHONE_SCENARIOS.map((key, index) => ({
      key,
      presenceHead: git("a"),
      deviceHead: git("b"),
      omniSipHead: git("c"),
      routingHead: git("d"),
      passed: true,
      realDevicePassed: true,
      noBlindRetryPassed: true,
      evidenceHash: hash("0123456789abcdef"[index]),
    })),
    blockingDeviceIssues: 0,
    summaryEvidenceHash: hash("f"),
  };
}

test("complete physical-device evidence qualifies READY", () => {
  const r = qualifyTask130Evidence(passingEvidence());
  assert.equal(r.status, "READY");
  assert.equal(r.requiredScenarios, 6);
  assert.equal(r.deviceModel, "TECNO BF7");
  assert.deepEqual(r.incomplete, []);
  assert.deepEqual(r.failed, []);
});

test("missing physical-device scenario is INCOMPLETE", () => {
  const e = passingEvidence();
  e.scenarios = e.scenarios.filter((s) => s.key !== "duplex-audio-media");
  const r = qualifyTask130Evidence(e);
  assert.equal(r.status, "INCOMPLETE");
  assert(r.incomplete.includes("missing-scenario:duplex-audio-media"));
});

test("source-head substitutions fail exact evidence binding", () => {
  const e = passingEvidence();
  e.scenarios[0].presenceHead = git("e");
  e.scenarios[1].deviceHead = git("e");
  e.scenarios[2].omniSipHead = git("e");
  e.scenarios[3].routingHead = git("e");
  const r = qualifyTask130Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("presence-head-mismatch:outbound-cellular-call"));
  assert(r.failed.includes("device-head-mismatch:inbound-cellular-routing"));
  assert(r.failed.includes("omnisip-head-mismatch:duplex-audio-media"));
  assert(r.failed.includes("routing-head-mismatch:connectivity-loss-reconnect"));
});

test("real-device and blind-retry safety fail independently", () => {
  const e = passingEvidence();
  e.scenarios[3].realDevicePassed = false;
  e.scenarios[4].noBlindRetryPassed = false;
  const r = qualifyTask130Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("real-device-failed:connectivity-loss-reconnect"));
  assert(
    r.failed.includes(
      "blind-retry-safety-failed:ambiguous-call-reconciliation",
    ),
  );
});

test("functional failure and blocking device issue prevent READY", () => {
  const e = passingEvidence();
  e.scenarios[5].passed = false;
  e.blockingDeviceIssues = 1;
  const r = qualifyTask130Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("scenario-failed:device-replacement-revocation"));
  assert(r.failed.includes("blocking-device-issues:1"));
});

test("duplicate, malformed and non-physical evidence reject", () => {
  const duplicate = passingEvidence();
  duplicate.scenarios.push({ ...duplicate.scenarios[0] });
  assert.throws(() => qualifyTask130Evidence(duplicate));

  const malformed = passingEvidence();
  malformed.summaryEvidenceHash = "bad";
  assert.throws(() => qualifyTask130Evidence(malformed));

  const wrongEnvironment = passingEvidence();
  wrongEnvironment.environmentClass = "production-like";
  assert.throws(() => qualifyTask130Evidence(wrongEnvironment));
});
