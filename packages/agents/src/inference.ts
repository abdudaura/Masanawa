import { PlatformError } from "@masanawa/contracts";
import type {
  AgentInferenceProvider,
  AgentInferenceRequest,
  AgentInferenceResult,
  AgentStrategyInput,
} from "./strategy.js";

export const agentInferenceFailureCodes = [
  "inference.unavailable",
  "inference.rate_limited",
  "inference.rejected",
  "inference.invalid_response",
] as const;
export type AgentInferenceFailureCode = (typeof agentInferenceFailureCodes)[number];

/** Safe, vendor-neutral failures. Never attach raw provider errors or payloads. */
export class AgentInferenceError extends PlatformError {
  constructor(code: AgentInferenceFailureCode) {
    const descriptions = {
      "inference.unavailable": ["unavailable", "Inference is temporarily unavailable.", true],
      "inference.rate_limited": ["rate-limit", "Inference capacity is temporarily limited.", true],
      "inference.rejected": ["unavailable", "Inference could not fulfill this request.", false],
      "inference.invalid_response": ["unavailable", "Inference returned an invalid response.", false],
    } as const;
    const [category, message, retryable] = descriptions[code];
    super({ code, category, message, retryable });
  }
}

function boundedText(value: unknown, maximum: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > maximum || (!allowEmpty && !value.trim())) {
    throw new TypeError("Invalid inference input");
  }
  return value;
}

/**
 * Copy only the inference envelope before any await. Canonical IDs, authority,
 * credentials and arbitrary caller fields never cross this port.
 * These are envelope limits, not token/cost/time budgets (Task 076).
 */
export function snapshotAgentInferenceRequest(request: AgentInferenceRequest): AgentInferenceRequest {
  if (!Array.isArray(request.systemInstructions) ||
      request.systemInstructions.length < 1 || request.systemInstructions.length > 64) {
    throw new TypeError("Invalid inference instructions");
  }
  const systemInstructions = Array.from(request.systemInstructions, (text: unknown) =>
    boundedText(text, 32_000),
  );
  if (systemInstructions.reduce((total, text) => total + text.length, 0) > 128_000) {
    throw new TypeError("Invalid inference instructions");
  }
  let input: AgentStrategyInput;
  switch (request.input.kind) {
    case "text":
      input = Object.freeze({ kind: "text", text: boundedText(request.input.text, 32_000) });
      break;
    case "media": {
      const caption = boundedText(request.input.caption, 32_000, true);
      const mimeType = boundedText(request.input.mimeType, 128);
      const dataBase64 = boundedText(request.input.dataBase64, 12_000_000);
      if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(mimeType) ||
          dataBase64.length % 4 !== 0 ||
          !/^[A-Za-z0-9+/]*={0,2}$/u.test(dataBase64)) {
        throw new TypeError("Invalid inference media");
      }
      input = Object.freeze({ kind: "media", caption, mimeType, dataBase64 });
      break;
    }
    default:
      throw new TypeError("Invalid inference input kind");
  }
  return Object.freeze({ systemInstructions: Object.freeze(systemInstructions), input });
}

/** Common response/failure admission for every replaceable inference edge. */
export async function generateAgentInference(
  provider: AgentInferenceProvider,
  request: AgentInferenceRequest,
): Promise<AgentInferenceResult> {
  const snapshot = snapshotAgentInferenceRequest(request);
  let result: AgentInferenceResult;
  try {
    result = await provider.generate(snapshot);
  } catch (error) {
    if (error instanceof AgentInferenceError) {
      // Reconstruct from an allowlist rather than trusting mutable error metadata.
      if ((agentInferenceFailureCodes as readonly string[]).includes(error.code)) {
        throw new AgentInferenceError(error.code as AgentInferenceFailureCode);
      }
    }
    throw new AgentInferenceError("inference.unavailable");
  }
  try {
    const text = result?.text;
    if (typeof text !== "string" || text.length > 128_000 || !text.trim()) {
      throw new TypeError("Invalid response");
    }
    return Object.freeze({ text: text.trim() });
  } catch {
    throw new AgentInferenceError("inference.invalid_response");
  }
}
