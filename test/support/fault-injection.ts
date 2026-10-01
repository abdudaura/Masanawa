export class InjectedCrash extends Error {
  readonly faultPoint: string;

  constructor(faultPoint: string) {
    super(`Injected crash at ${faultPoint}`);
    this.name = "InjectedCrash";
    this.faultPoint = faultPoint;
  }
}

export interface FaultInjector {
  checkpoint(point: string): void;
  hits(point: string): number;
  remaining(point: string): number;
}

export function createFaultInjector(
  plan: Readonly<Record<string, number>>,
): FaultInjector {
  const remaining = new Map<string, number>();
  const hits = new Map<string, number>();

  for (const [point, count] of Object.entries(plan)) {
    const normalized = point.trim();
    if (!normalized) {
      throw new TypeError("fault point is required");
    }
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(
        `fault count for ${point} must be a non-negative safe integer`,
      );
    }
    if (remaining.has(normalized)) {
      throw new TypeError(`fault point ${normalized} is duplicated`);
    }
    remaining.set(normalized, count);
  }

  return Object.freeze({
    checkpoint(point: string): void {
      const normalized = point.trim();
      if (!normalized) {
        throw new TypeError("fault point is required");
      }
      hits.set(normalized, (hits.get(normalized) ?? 0) + 1);
      const count = remaining.get(normalized) ?? 0;
      if (count <= 0) {
        return;
      }
      remaining.set(normalized, count - 1);
      throw new InjectedCrash(normalized);
    },
    hits(point: string): number {
      return hits.get(point.trim()) ?? 0;
    },
    remaining(point: string): number {
      return remaining.get(point.trim()) ?? 0;
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
    ((error: unknown) => error instanceof InjectedCrash);

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
