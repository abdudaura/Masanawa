export class FaultInjectionError extends Error {
  readonly checkpoint: string;
  readonly occurrence: number;

  constructor(checkpoint: string, occurrence: number) {
    super(`Injected fault at ${checkpoint} occurrence ${occurrence}`);
    this.name = "FaultInjectionError";
    this.checkpoint = checkpoint;
    this.occurrence = occurrence;
  }
}

export interface FaultRule {
  readonly checkpoint: string;
  readonly occurrences: readonly number[];
}

export interface FaultInjector {
  hit(checkpoint: string): void;
  count(checkpoint: string): number;
  remaining(checkpoint: string): readonly number[];
}

function normalizeCheckpoint(checkpoint: string): string {
  const normalized = checkpoint.trim();
  if (!normalized) {
    throw new TypeError("fault checkpoint is required");
  }
  return normalized;
}

function normalizeOccurrences(
  checkpoint: string,
  occurrences: readonly number[],
): readonly number[] {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const occurrence of occurrences) {
    if (!Number.isSafeInteger(occurrence) || occurrence < 1) {
      throw new TypeError(
        `fault occurrence for ${checkpoint} must be a positive safe integer`,
      );
    }
    if (seen.has(occurrence)) {
      throw new TypeError(
        `fault occurrence ${occurrence} for ${checkpoint} is duplicated`,
      );
    }
    seen.add(occurrence);
    normalized.push(occurrence);
  }

  normalized.sort((left, right) => left - right);
  return Object.freeze(normalized);
}

export function createFaultInjector(
  rules: readonly FaultRule[],
): FaultInjector {
  const remainingByCheckpoint = new Map<string, Set<number>>();
  const counts = new Map<string, number>();

  for (const rule of rules) {
    const checkpoint = normalizeCheckpoint(rule.checkpoint);
    if (remainingByCheckpoint.has(checkpoint)) {
      throw new TypeError(`fault checkpoint ${checkpoint} is duplicated`);
    }

    remainingByCheckpoint.set(
      checkpoint,
      new Set(normalizeOccurrences(checkpoint, rule.occurrences)),
    );
  }

  return Object.freeze({
    hit(checkpointInput: string): void {
      const checkpoint = normalizeCheckpoint(checkpointInput);
      const occurrence = (counts.get(checkpoint) ?? 0) + 1;
      counts.set(checkpoint, occurrence);

      const configured = remainingByCheckpoint.get(checkpoint);
      if (configured?.delete(occurrence)) {
        throw new FaultInjectionError(checkpoint, occurrence);
      }
    },

    count(checkpointInput: string): number {
      return counts.get(normalizeCheckpoint(checkpointInput)) ?? 0;
    },

    remaining(checkpointInput: string): readonly number[] {
      const checkpoint = normalizeCheckpoint(checkpointInput);
      return Object.freeze(
        [...(remainingByCheckpoint.get(checkpoint) ?? [])].sort(
          (left, right) => left - right,
        ),
      );
    },
  });
}

export interface RestartScenario<Runtime, Result> {
  readonly maxRestarts: number;
  createRuntime(generation: number): Runtime | Promise<Runtime>;
  run(runtime: Runtime, generation: number): Result | Promise<Result>;
  dispose(runtime: Runtime, generation: number): void | Promise<void>;
  shouldRestart?(error: unknown, generation: number): boolean;
}

async function disposeAfterFailure<Runtime, Result>(
  scenario: RestartScenario<Runtime, Result>,
  runtime: Runtime,
  generation: number,
  failure: unknown,
): Promise<void> {
  try {
    await scenario.dispose(runtime, generation);
  } catch (cleanupFailure) {
    throw new AggregateError(
      [failure, cleanupFailure],
      "Runtime failed and cleanup also failed",
    );
  }
}

export async function runRestartScenario<Runtime, Result>(
  scenario: RestartScenario<Runtime, Result>,
): Promise<Result> {
  if (
    !Number.isSafeInteger(scenario.maxRestarts) ||
    scenario.maxRestarts < 0
  ) {
    throw new TypeError("maxRestarts must be a non-negative safe integer");
  }

  const shouldRestart =
    scenario.shouldRestart ??
    ((error: unknown) => error instanceof FaultInjectionError);

  let generation = 0;

  while (true) {
    const runtime = await scenario.createRuntime(generation);

    let result: Result;
    try {
      result = await scenario.run(runtime, generation);
    } catch (failure) {
      await disposeAfterFailure(scenario, runtime, generation, failure);

      if (
        generation >= scenario.maxRestarts ||
        !shouldRestart(failure, generation)
      ) {
        throw failure;
      }

      generation += 1;
      continue;
    }

    await scenario.dispose(runtime, generation);
    return result;
  }
}
