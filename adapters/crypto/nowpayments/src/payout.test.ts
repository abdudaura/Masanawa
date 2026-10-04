import { describe, it, expect, vi } from "vitest";
import { NowPaymentsPayoutClient } from "./payout.js";

function client(fetch: typeof globalThis.fetch) {
  return new NowPaymentsPayoutClient({
    apiKey: "fixture",
    email: "test@example.com",
    password: "fixture",
    fetch,
  });
}

describe("NOWPayments payout client", () => {
  it.each(["10.000000000000000001", "9007199254740993", "0.00000001"])(
    "rejects lossy or provider-unsupported payout precision before authentication: %s",
    async (amount) => {
      const fetch = vi.fn();
      await expect(client(fetch).createPayout({
        amount,
        currency: "usdttrc20",
        address: "address",
      })).rejects.toThrow("nowpayments.payout.amount.invalid");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("submits a representable amount once after authentication", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "123", status: "waiting" })));
    expect(await client(fetch).createPayout({
      amount: "10.00",
      currency: "usdttrc20",
      address: "address",
    })).toEqual({ payoutId: "123", withdrawalId: null, status: "waiting" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)).withdrawals[0].amount).toBe(10);
  });

  it("validates the address without authenticating or moving funds", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ address: "address" })));
    await expect(client(fetch).validateAddress({
      currency: "USDTTRC20",
      address: "address",
    })).resolves.toEqual({
      valid: true,
      currency: "USDTTRC20",
      address: "address",
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.nowpayments.io/v1/payout/validate-address");
  });

  it("maps provider address rejection to a deterministic invalid-address error", async () => {
    const fetch = vi.fn(async () => new Response("invalid", { status: 400 }));
    await expect(client(fetch).validateAddress({
      currency: "BTC",
      address: "wrong",
    })).rejects.toThrow("nowpayments.payout.address.invalid");
  });

  it("rejects a representable seven-decimal fee quote before provider access", async () => {
    const fetch = vi.fn();
    await expect(client(fetch).getPayoutFeeEstimate({
      currency: "TRX",
      amount: "1.1234567",
    })).rejects.toThrow("nowpayments.payout.amount.invalid");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns exact current network fee and payout minimum evidence", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ currency: "trx", fee: "0.123400" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: "1.500000" })));
    await expect(client(fetch).getPayoutFeeEstimate({
      currency: "TRX",
      amount: "10.00",
    })).resolves.toEqual({ currency: "TRX", amount: "10", fee: "0.1234" });
    await expect(client(fetch).getMinimumPayoutAmount({ currency: "TRX" }))
      .resolves.toEqual({ currency: "TRX", minimumAmount: "1.5" });
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/v1/payout/fee?");
    expect(fetch.mock.calls[1]?.[0]).toBe("https://api.nowpayments.io/v1/payout-withdrawal/min-amount/trx");
  });

  it("classifies payout validation rejection separately from transport ambiguity", async () => {
    const rejectedFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response("invalid payout", { status: 422 }));
    await expect(client(rejectedFetch).createPayout({
      amount: "10", currency: "trx", address: "address",
    })).rejects.toThrow("nowpayments.payout.dispatch_rejected");

    const transportFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockRejectedValueOnce(new Error("socket reset"));
    await expect(client(transportFetch).createPayout({
      amount: "10", currency: "trx", address: "address",
    })).rejects.toThrow("nowpayments.payout.transport.unavailable");
  });

  it("classifies authentication failure as definitely pre-dispatch", async () => {
    const fetch = vi.fn(async () => new Response("denied", { status: 401 }));
    await expect(client(fetch).createPayout({
      amount: "10", currency: "trx", address: "address",
    })).rejects.toThrow("nowpayments.payout.authentication_unavailable");
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/v1/auth");
  });

  it("preserves batch and individual withdrawal identity from creation", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "batch-1",
        withdrawals: [{ id: "withdrawal-1", status: "WAITING" }],
      })));
    await expect(client(fetch).createPayout({
      amount: "10", currency: "trx", address: "address",
      uniqueExternalId: "tenant.request",
    })).resolves.toEqual({
      payoutId: "batch-1", withdrawalId: "withdrawal-1", status: "waiting",
    });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)).withdrawals[0].unique_external_id)
      .toBe("tenant.request");
  });

  it("rejects non-six-digit verification codes before authentication", async () => {
    const fetch = vi.fn();
    await expect(client(fetch).verifyPayout({
      payoutId: "batch-1",
      verificationCode: "1234",
    })).rejects.toThrow("nowpayments.payout.verification_code.invalid");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("verifies the payout batch with a six-digit merchant code", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "PROCESSING" })));
    await expect(client(fetch).verifyPayout({
      payoutId: "batch-1",
      verificationCode: "123456",
    })).resolves.toEqual({ status: "processing" });
    expect(fetch.mock.calls[1]?.[0])
      .toBe("https://api.nowpayments.io/v1/payout/batch-1/verify");
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)))
      .toEqual({ verification_code: "123456" });
  });

  it("reconciles a stored batch id through exact single-withdrawal evidence", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payouts: [{
          id: "withdrawal-1",
          batch_withdrawal_id: "batch-1",
          payout_status: "FINISHED",
          currency: "trx",
          amount: "10.000000",
          address: "address",
          unique_external_id: "tenant.request",
        }],
      })));
    await expect(client(fetch).getPayoutEvidence({ payoutId: "batch-1" })).resolves.toEqual({
      batchId: "batch-1",
      withdrawalId: "withdrawal-1",
      status: "finished",
      currency: "TRX",
      amount: "10",
      address: "address",
      uniqueExternalId: "tenant.request",
    });
    const url = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(url.pathname).toBe("/v1/payout");
    expect(url.searchParams.get("batch_id")).toBe("batch-1");
  });

  it("fails closed when batch status evidence is missing or ambiguous", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fixture-jwt" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        payouts: [
          { id: "one", batch_withdrawal_id: "batch-1", status: "waiting" },
          { id: "two", batch_withdrawal_id: "batch-1", status: "waiting" },
        ],
      })));
    await expect(client(fetch).getPayoutStatus({ payoutId: "batch-1" }))
      .rejects.toThrow("nowpayments.payout.evidence_unavailable");
  });
});
