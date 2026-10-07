import { parseCanonicalId, PlatformError } from "@masanawa/contracts";
import type { FastifyInstance } from "fastify";
import type { CreatorEconomyService, CreatorEconomySnapshot } from "./creator_economy.js";

interface EconomyNode {
  readonly type: "heading" | "text" | "metric" | "notice";
  readonly id?: string;
  readonly text: string;
  readonly value?: string;
  readonly subtitle?: string;
  readonly tone?: "info";
}
export interface CreatorEconomyShellDocument {
  readonly version: 1;
  readonly id: string;
  readonly revision: number;
  readonly fallback: string;
  readonly nodes: readonly EconomyNode[];
}
const fields = ["customerCredits", "agentFloatCredits", "pendingEarningsCredits", "availableEarningsCredits"] as const;
const credits = (amount: number) => `${amount.toLocaleString("en-US")} Credits`;
function validate(snapshot: CreatorEconomySnapshot): void {
  if (typeof snapshot.hasClone !== "boolean") throw new TypeError("Invalid economy snapshot");
  for (const field of fields) {
    if (!Number.isSafeInteger(snapshot[field]) || snapshot[field] < 0) throw new TypeError("Invalid economy snapshot");
  }
  if (snapshot.hasClone) {
    if (typeof snapshot.characterId !== "string") throw new TypeError("Invalid economy snapshot");
    parseCanonicalId("character", snapshot.characterId);
  } else if (snapshot.characterId !== null || snapshot.agentFloatCredits || snapshot.pendingEarningsCredits || snapshot.availableEarningsCredits) {
    throw new TypeError("Invalid economy snapshot");
  }
}
/** Pure read projection. It cannot authorize allocations, funding or withdrawals. */
export function projectCreatorEconomyToShellDocument(snapshot: CreatorEconomySnapshot, options: {
  readonly documentId: string;
  readonly revision: number;
}): CreatorEconomyShellDocument {
  validate(snapshot);
  if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(options.documentId) || !Number.isSafeInteger(options.revision) || options.revision < 0) {
    throw new TypeError("Invalid economy document scope");
  }
  const nodes: EconomyNode[] = [
    { type: "heading", text: "Wallet and earnings" },
    { type: "metric", id: "customer-credits", text: "Customer Credits", value: credits(snapshot.customerCredits), subtitle: "For purchases and paid work. These Credits cannot be withdrawn." },
  ];
  if (snapshot.hasClone) {
    nodes.push(
      { type: "metric", id: "agent-float", text: "Agent Float", value: credits(snapshot.agentFloatCredits), subtitle: "Your clone’s execution capital. Float cannot be withdrawn." },
      { type: "metric", id: "pending-earnings", text: "Pending earnings", value: credits(snapshot.pendingEarningsCredits), subtitle: "Revenue awaiting settlement." },
      { type: "metric", id: "available-earnings", text: "Available earnings", value: credits(snapshot.availableEarningsCredits), subtitle: "Settled revenue. A withdrawal still needs an eligible, confirmed payout route." },
    );
  } else {
    nodes.push({ type: "notice", tone: "info", text: "Create your personal clone to see its Agent Float and earnings." });
  }
  nodes.push({ type: "text", text: "Crypto balances are separate from Credits, Agent Float and earnings." });
  const fallback = `Customer Credits: ${credits(snapshot.customerCredits)}.${snapshot.hasClone ? ` Agent Float: ${credits(snapshot.agentFloatCredits)}. Pending earnings: ${credits(snapshot.pendingEarningsCredits)}. Available earnings: ${credits(snapshot.availableEarningsCredits)}.` : " Create your personal clone to see its Float and earnings."}`;
  return Object.freeze({ version: 1 as const, id: options.documentId, revision: options.revision, fallback, nodes: Object.freeze(nodes.map(node => Object.freeze(node))) });
}

export function createCreatorEconomyShell(input: { readonly economy: Pick<CreatorEconomyService, "read"> }) {
  return Object.freeze({
    async read(request: { readonly authorizationHeader: string | undefined; readonly documentId: string; readonly revision: number }) {
      // A failed read propagates; no fabricated zero balance, cached authority or cross-account state.
      const snapshot = await input.economy.read({ authorizationHeader: request.authorizationHeader });
      return Object.freeze({ snapshot, document: projectCreatorEconomyToShellDocument(snapshot, request) });
    },
  });
}

/** Standalone registrar consumed by the shared Gateway owner. */
export async function registerCreatorEconomyShellRoutes(app: FastifyInstance, input: {
  readonly shell: ReturnType<typeof createCreatorEconomyShell>;
  /** Assign a monotonic revision in existing document custody before publication. */
  readonly nextDocumentScope: (request: { readonly authorizationHeader: string | undefined }) => Promise<{ readonly documentId: string; readonly revision: number }>;
}): Promise<void> {
  await app.register(async routes => {
    routes.get("/creator/economy/document", async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      const auth = { authorizationHeader: request.headers.authorization };
      try {
        const scope = await input.nextDocumentScope(auth);
        return await input.shell.read({ ...auth, ...scope });
      } catch (error) {
        const status = error instanceof PlatformError && error.category === "authentication" ? 401
          : error instanceof PlatformError && error.category === "authorization" ? 403 : 503;
        return reply.code(status).send({ error: status === 503 ? "creator.economy.unavailable" : "creator.economy.denied", message: status === 503 ? "Balances could not be refreshed. Try again shortly." : "Sign in with an authorized account." });
      }
    });
  });
}
