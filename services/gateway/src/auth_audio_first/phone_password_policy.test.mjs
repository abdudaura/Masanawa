import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePasswordPhone, assertNumericPassword, hashNumericPassword, verifyNumericPassword,
} from "./phone_password_policy.ts";

const pepper = "x".repeat(48);

test("accepts E.164 without assuming possession", () => {
  assert.equal(normalizePasswordPhone("+2348012345678"), "+2348012345678");
  for (const number of ["08012345678", "+00000000", "+234abc", "+123 4567", ""]) {
    assert.throws(() => normalizePasswordPhone(number));
  }
});
test("rejects weak or malformed numeric passwords", () => {
  for (const value of ["12345678","87654321","00000000","1234567","12345678901234567","notsecret"]) {
    assert.throws(() => assertNumericPassword(value));
  }
  assert.equal(assertNumericPassword("80469127"), "80469127");
  assert.throws(() => assertNumericPassword("8012345678", "+2348012345678"));
});
test("salted hashes differ and verify without exposing stored material", async () => {
  const first = await hashNumericPassword("80469127", pepper);
  const second = await hashNumericPassword("80469127", pepper);
  assert.notEqual(first, second);
  assert.equal(await verifyNumericPassword("80469127", first, pepper), true);
  assert.equal(await verifyNumericPassword("80469128", first, pepper), false);
  assert.equal(await verifyNumericPassword("80469127", first, "y".repeat(48)), false);
});
test("unknown or corrupt hashes consume the verifier path and fail closed", async () => {
  assert.equal(await verifyNumericPassword("80469127", null, pepper), false);
  assert.equal(await verifyNumericPassword("80469127", "scrypt:v1:broken", pepper), false);
  assert.equal(await verifyNumericPassword("hello", null, pepper), false);
  await assert.rejects(hashNumericPassword("80469127", "short"));
});
