import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { FlutterwaveWebhookError } from "@masanawa/providers";
import type { BillingCheckoutService } from "./billing_checkout.js";
import type { BillingFinancialService } from "./financial_billing.js";
import type { BillingWalletService } from "./billing_wallet.js";

export function registerBillingRoutes(
  app: FastifyInstance,
  options: Readonly<{
    billingCheckout?: BillingCheckoutService;
    billingFinancial?: BillingFinancialService;
    billingWallet?: BillingWalletService;
  }>,
): void {
  const checkout = options.billingCheckout;
  if (checkout) {
    const billingError = (
      error: unknown,
      reply: { code(statusCode: number): unknown },
    ) => {
      const message = error instanceof Error ? error.message : "";
      if (
        message === "financial.auth.unauthorized" ||
        message === "UNAUTHORIZED"
      ) {
        reply.code(401);
        return { error: "billing_unauthorized" };
      }
      if (message === "financial.billing.quote_not_found") {
        reply.code(404);
        return { error: "billing_quote_not_found" };
      }
      if (
        message.includes("payment_not_successful") ||
        message.includes("quote_revision_conflict") ||
        message.includes("quote_expired") ||
        message.includes("checkout_not_created") ||
        message.includes("checkout_creation_in_progress")
      ) {
        reply.code(409);
        return { error: message };
      }
      if (
        message.includes("catalog_") ||
        message.includes("recipient_") ||
        message.includes("amount_") ||
        message.includes("phone_invalid") ||
        message.includes("email_required")
      ) {
        reply.code(400);
        return { error: message };
      }
      reply.code(503);
      return { error: "billing_checkout_unavailable" };
    };

    app.post(
      "/v1/commerce/bills/quotes",
      {
        schema: {
          body: Type.Object(
            {
              categoryCode: Type.String({ minLength: 1, maxLength: 128 }),
              billerCode: Type.String({ minLength: 1, maxLength: 128 }),
              itemCode: Type.String({ minLength: 1, maxLength: 128 }),
              customerId: Type.String({ minLength: 1, maxLength: 200 }),
              amount: Type.String({ minLength: 1, maxLength: 80 }),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const body = request.body as {
            categoryCode: string;
            billerCode: string;
            itemCode: string;
            customerId: string;
            amount: string;
          };
          return await checkout.createQuote({
            authorizationHeader: request.headers.authorization,
            ...body,
          });
        } catch (error) {
          return billingError(error, reply);
        }
      },
    );

    app.get(
      "/v1/commerce/bills/quotes",
      {
        schema: {
          querystring: Type.Object(
            { limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const query = request.query as { limit?: number };
          return {
            quotes: await checkout.list({
              authorizationHeader: request.headers.authorization,
              ...(query.limit === undefined ? {} : { limit: query.limit }),
            }),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          reply.code(
            message === "financial.auth.unauthorized" ||
              message === "UNAUTHORIZED"
              ? 401
              : 503,
          );
          return { error: "billing_history_unavailable" };
        }
      },
    );

    app.get(
      "/v1/commerce/bills/quotes/:quoteId",
      {
        schema: {
          params: Type.Object(
            { quoteId: Type.String({ minLength: 1, maxLength: 180 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as { quoteId: string };
          return await checkout.read({
            authorizationHeader: request.headers.authorization,
            quoteId: params.quoteId,
          });
        } catch (error) {
          return billingError(error, reply);
        }
      },
    );

    app.post(
      "/v1/commerce/bills/quotes/:quoteId/checkout",
      {
        schema: {
          params: Type.Object(
            { quoteId: Type.String({ minLength: 1, maxLength: 180 }) },
            { additionalProperties: false },
          ),
          body: Type.Object(
            {
              quoteRevision: Type.Integer({ minimum: 1 }),
              checkoutEmail: Type.Optional(
                Type.String({ minLength: 3, maxLength: 320 }),
              ),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as { quoteId: string };
          const body = request.body as {
            quoteRevision: number;
            checkoutEmail?: string;
          };
          return await checkout.startCheckout({
            authorizationHeader: request.headers.authorization,
            quoteId: params.quoteId,
            quoteRevision: body.quoteRevision,
            ...(body.checkoutEmail === undefined
              ? {}
              : { checkoutEmail: body.checkoutEmail }),
          });
        } catch (error) {
          return billingError(error, reply);
        }
      },
    );

    app.post(
      "/v1/commerce/bills/quotes/:quoteId/verify",
      {
        schema: {
          params: Type.Object(
            { quoteId: Type.String({ minLength: 1, maxLength: 180 }) },
            { additionalProperties: false },
          ),
          body: Type.Object(
            { quoteRevision: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as { quoteId: string };
          const body = request.body as { quoteRevision: number };
          return await checkout.verifyAndPurchase({
            authorizationHeader: request.headers.authorization,
            quoteId: params.quoteId,
            quoteRevision: body.quoteRevision,
          });
        } catch (error) {
          return billingError(error, reply);
        }
      },
    );

    app.get("/billing/return", async (_request, reply) =>
      reply.type("text/html; charset=utf-8").send(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masanawa payment</title><main style="font-family:system-ui;max-width:560px;margin:64px auto;padding:20px"><h1>Payment received</h1><p>Return to Masanawa and choose <strong>Verify payment</strong>. Masanawa independently verifies Flutterwave before sending the bill.</p></main>',
      ),
    );
  }

  const wallet = options.billingWallet;
  if (wallet) {
    app.get("/v1/wallet/ngn", async (request, reply) => {
      try {
        return await wallet.balance({
          authorizationHeader: request.headers.authorization,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        reply.code(
          message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
            ? 401
            : 503,
        );
        return { error: "wallet_unavailable" };
      }
    });

    app.get(
      "/v1/commerce/bills/quotes/:quoteId/wallet-status",
      {
        schema: {
          params: Type.Object(
            { quoteId: Type.String({ minLength: 1, maxLength: 180 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as { quoteId: string };
          return await wallet.readQuoteFunding({
            authorizationHeader: request.headers.authorization,
            quoteId: params.quoteId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const status = message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
            ? 401 : message === "financial.billing.quote_not_found" ? 404 : 503;
          reply.code(status);
          return { error: status === 401 ? "billing_unauthorized" : status === 404
            ? "billing_quote_not_found" : "billing_wallet_status_unavailable" };
        }
      },
    );

    app.post(
      "/v1/wallet/ngn/funding",
      {
        schema: {
          body: Type.Object(
            { amount: Type.String({ minLength: 1, maxLength: 80 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const body = request.body as { amount: string };
          return await wallet.createFunding({
            authorizationHeader: request.headers.authorization,
            amount: body.amount,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          reply.code(
            message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
              ? 401
              : message.includes("amount") || message.includes("virtual_account")
                ? 400
                : 503,
          );
          return { error: message || "wallet_funding_unavailable" };
        }
      },
    );

    app.post(
      "/v1/commerce/bills/quotes/:quoteId/confirm-wallet",
      {
        schema: {
          params: Type.Object(
            { quoteId: Type.String({ minLength: 1, maxLength: 180 }) },
            { additionalProperties: false },
          ),
          body: Type.Object(
            { quoteRevision: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false },
          ),
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as { quoteId: string };
          const body = request.body as { quoteRevision: number };
          return await wallet.confirmAndPurchase({
            authorizationHeader: request.headers.authorization,
            quoteId: params.quoteId,
            quoteRevision: body.quoteRevision,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          reply.code(
            message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
              ? 401
              : message.includes("quote_not_found")
                ? 404
                : message.includes("catalog_") ||
                    message.includes("recipient_") ||
                    message.includes("amount_") ||
                    message.includes("phone_invalid")
                  ? 400
                  : 409,
          );
          return { error: message || "billing_wallet_purchase_unavailable" };
        }
      },
    );
  }

  const billing = options.billingFinancial;
  if (!billing) return;

  app.get("/v1/commerce/bills/categories", async (request, reply) => {
    try {
      return {
        categories: await billing.listCategories({
          authorizationHeader: request.headers.authorization,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      reply.code(
        message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
          ? 401
          : 503,
      );
      return { error: "billing_catalog_unavailable" };
    }
  });

  app.get(
    "/v1/commerce/bills/categories/:categoryCode/billers",
    {
      schema: {
        params: Type.Object({
          categoryCode: Type.String({ minLength: 1, maxLength: 128 }),
        }),
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { categoryCode: string };
        return {
          billers: await billing.listBillers({
            authorizationHeader: request.headers.authorization,
            categoryCode: params.categoryCode,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        reply.code(
          message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
            ? 401
            : 503,
        );
        return { error: "billing_catalog_unavailable" };
      }
    },
  );

  app.get(
    "/v1/commerce/bills/billers/:billerCode/items",
    {
      schema: {
        params: Type.Object({
          billerCode: Type.String({ minLength: 1, maxLength: 128 }),
        }),
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { billerCode: string };
        return {
          items: await billing.listItems({
            authorizationHeader: request.headers.authorization,
            billerCode: params.billerCode,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        reply.code(
          message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
            ? 401
            : 503,
        );
        return { error: "billing_catalog_unavailable" };
      }
    },
  );

  app.get(
    "/v1/commerce/bills/purchases/:reference",
    {
      schema: {
        params: Type.Object({
          reference: Type.String({ minLength: 1, maxLength: 128 }),
        }),
        querystring: Type.Object(
          { refresh: Type.Optional(Type.Boolean()) },
          { additionalProperties: false },
        ),
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { reference: string };
        const query = request.query as { refresh?: boolean };
        return await billing.readPurchase({
          authorizationHeader: request.headers.authorization,
          reference: params.reference,
          refresh: query.refresh === true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        reply.code(
          message === "financial.auth.unauthorized" || message === "UNAUTHORIZED"
            ? 401
            : message === "financial.billing_not_found"
              ? 404
              : 503,
        );
        return { error: "billing_purchase_unavailable" };
      }
    },
  );

  app.post(
    "/v1/webhooks/flutterwave",
    { schema: { body: Type.Unknown() } },
    async (request, reply) => {
      const verifHash = request.headers["verif-hash"];
      const encoded = Buffer.from(JSON.stringify(request.body ?? {}), "utf8");
      try {
        if (wallet) {
          const funding = await wallet.receiveFundingWebhook({
            rawBody: encoded,
            verifHash: typeof verifHash === "string" ? verifHash : null,
          });
          if (funding.handled) {
            return {
              accepted: true,
              duplicate: funding.duplicate,
              funding: true,
              resumed: funding.resumed,
            };
          }
        }
        const result = await billing.receiveWebhook({
          rawBody: encoded,
          verifHash: typeof verifHash === "string" ? verifHash : null,
        });
        if (result.reference && checkout) {
          // Do not acknowledge a provider webhook before durable reconciliation.
          // Repeated delivery can retry the same canonical fulfillment reference.
          await checkout.reconcileFulfillment({ reference: result.reference });
        }
        return { accepted: true, duplicate: result.duplicate };
      } catch (error) {
        if (error instanceof FlutterwaveWebhookError) {
          reply.code(
            error.code === "invalid_signature" ? 401 :
            error.code === "payload_too_large" ? 413 : 400,
          );
          return { error: error.code };
        }
        // A valid signed event with an unavailable ledger, provider or
        // reconciliation path must remain retryable. A false 401 would cause
        // provider delivery to be discarded after a credit-before-bill crash.
        reply.code(503);
        return { error: "billing_webhook_processing_unavailable" };
      }
    },
  );
}

