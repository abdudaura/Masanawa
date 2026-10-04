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
    if (!normalized) throw new TypeError("fault point is required");
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`fault count for ${point} must be a non-negative safe integer`);
    }
    remaining.set(normalized, count);
  }

  return Object.freeze({
    checkpoint(point: string): void {
      const normalized = point.trim();
      if (!normalized) throw new TypeError("fault point is required");
      hits.set(normalized, (hits.get(normalized) ?? 0) + 1);
      const count = remaining.get(normalized) ?? 0;
      if (count <= 0) return;
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
