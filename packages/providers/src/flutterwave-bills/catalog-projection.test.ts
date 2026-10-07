import { describe, expect, it } from "vitest";
import { projectFlutterwaveBillItems } from "./catalog-projection.js";

describe("projectFlutterwaveBillItems", () => {
  it("keeps provider cost separate from Masanawa retail economics", () => {
    const projected = projectFlutterwaveBillItems(
      [{
        billerCode: "BIL-MTN",
        itemCode: "DATA-1GB",
        name: "1 GB Data",
        amount: "750.50",
        currency: "NGN",
        labelName: "Phone Number",
      }],
      {
        quote(input) {
          expect(input.providerAmount).toBe("750.50");
          return {
            priceCredits: 900,
            fulfillmentReserveCredits: 760,
            creatorCommissionCredits: 90,
            fallbackCommissionCredits: 30,
            platformMarginCredits: 50,
            pricingPolicyVersion: "ng-bills-v1",
          };
        },
      },
    );
    expect(projected[0]).toMatchObject({
      provider: "flutterwave",
      providerAmount: "750.50",
      key: "flutterwave-bill-bil-mtn-data-1gb",
      economics: {
        priceCredits: 900,
        creatorCommissionCredits: 90,
        platformMarginCredits: 50,
      },
    });
  });

  it("rejects a pricing policy whose deterministic split does not equal retail price", () => {
    expect(() =>
      projectFlutterwaveBillItems(
        [{
          billerCode: "B",
          itemCode: "I",
          name: "Bill",
          amount: "100",
          currency: "NGN",
          labelName: null,
        }],
        {
          quote() {
            return {
              priceCredits: 100,
              fulfillmentReserveCredits: 80,
              creatorCommissionCredits: 30,
              fallbackCommissionCredits: 0,
              platformMarginCredits: 0,
              pricingPolicyVersion: "bad",
            };
          },
        },
      ),
    ).toThrow("Billing Offer economics do not sum to price");
  });
});
