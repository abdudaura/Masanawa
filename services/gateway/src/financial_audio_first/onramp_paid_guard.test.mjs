import assert from "node:assert/strict";
import { test } from "node:test";
import { assertFiatOnRampFinishedFunded } from "./onramp_paid_guard.ts";

const finished = (paid, due = "1500") =>
  ({ status: "finished", payAmount: due, actuallyPaid: paid });

test("finished fiat purchases require complete payment at exact 18-digit precision", () => {
  assert.doesNotThrow(() => assertFiatOnRampFinishedFunded(finished("1500")));
  assert.doesNotThrow(() => assertFiatOnRampFinishedFunded(finished("1500.000000000000000001")));
  assert.doesNotThrow(() => assertFiatOnRampFinishedFunded(finished("0.000000000000000002", "0.000000000000000001")));
  assert.throws(() => assertFiatOnRampFinishedFunded(finished("1499.999999999999999999")), /onramp_evidence_mismatch/);
  assert.throws(() => assertFiatOnRampFinishedFunded(finished("0.000000000000000001", "0.000000000000000002")), /onramp_evidence_mismatch/);
  assert.throws(() => assertFiatOnRampFinishedFunded(finished("0")), /onramp_evidence_mismatch/);
  assert.throws(() => assertFiatOnRampFinishedFunded(finished("0", "0")), /onramp_evidence_mismatch/);
});

test("pending, confirming and partly paid evidence remains recoverable, never auto-settled by this guard", () => {
  for (const status of ["waiting", "confirming", "confirmed", "sending", "partially_paid", "failed", "refunded", "expired"]) {
    assert.doesNotThrow(() => assertFiatOnRampFinishedFunded({
      status, payAmount: "1500", actuallyPaid: "0",
    }));
  }
});

test("malformed finished amounts never reach the financial repository", () => {
  for (const paid of ["1e3", "-1", "NaN", "Infinity", "+1", "01", "1.0000000000000000001", " 1500", "1500\n", "", "9".repeat(81)]) {
    assert.throws(() => assertFiatOnRampFinishedFunded(finished(paid)), /onramp_evidence_invalid/);
  }
  for (const due of ["-1", "0.0000000000000000001", " 1500", "1e2"]) {
    assert.throws(() => assertFiatOnRampFinishedFunded(finished("1500", due)), /onramp_evidence_invalid/);
  }
});
