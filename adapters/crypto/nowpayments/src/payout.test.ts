import { it, expect, vi } from "vitest";
import { NowPaymentsPayoutClient } from "./payout.js";
it.each(["10.000000000000000001", "9007199254740993", "0.00000001"])("rejects numeric wire precision loss before authentication: %s", async amount => {
  const fetch = vi.fn();
  const client = new NowPaymentsPayoutClient({ apiKey: "fixture", email: "test@example.com", password: "fixture", fetch });
  await expect(client.createPayout({ amount, currency: "usdttrc20", address: "address" })).rejects.toThrow("nowpayments.payout.amount.invalid");
  expect(fetch).not.toHaveBeenCalled();
});
it("submits a representable amount once after authentication", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "123", status: "waiting" })));
  const client = new NowPaymentsPayoutClient({ apiKey: "fixture", email: "test@example.com", password: "fixture", fetch });
  expect(await client.createPayout({ amount: "10.00", currency: "usdttrc20", address: "address" }))
    .toEqual({ payoutId: "123", status: "waiting" });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetch.mock.calls[1]![1].body).withdrawals[0].amount).toBe(10);
});
