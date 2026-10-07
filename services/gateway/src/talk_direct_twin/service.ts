import type { PlatformSessionIdentity } from "@masanawa/security";

export interface DirectTwinSeatRecord {
  readonly tenantId: string;
  readonly talkId: string;
  readonly seatId: string;
  readonly personaId: string;
  readonly kind: "expert" | "twin";
  readonly ownerUserId: string | null;
  readonly admitted: boolean;
  readonly removed: boolean;
}

export interface DirectTwinInstructionRecord {
  readonly tenantId: string;
  readonly talkId: string;
  readonly seatId: string;
  readonly personaId: string;
  readonly ownerUserId: string;
  readonly revision: number;
  readonly instruction: string | null;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
}

export interface DirectTwinRepository {
  readSeat(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
  }>): Promise<DirectTwinSeatRecord | null>;
  listOwnedTwinSeats(input: Readonly<{
    tenantId: string;
    talkId: string;
    ownerUserId: string;
  }>): Promise<readonly DirectTwinSeatRecord[]>;
  readInstruction(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
  }>): Promise<DirectTwinInstructionRecord | null>;
  writeInstruction(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
    personaId: string;
    ownerUserId: string;
    expectedRevision: number | null;
    instruction: string | null;
    updatedAt: string;
    expiresAt: string | null;
  }>): Promise<DirectTwinInstructionRecord>;
}

export interface DirectTwinAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export interface DirectTwinService {
  mine(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<readonly Readonly<{ seatId: string; personaId: string }>[]>;

  read(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    seatId: string;
  }>): Promise<Readonly<{
    revision: number;
    instruction: string | null;
    expiresAt: string | null;
  }>>;
  set(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    seatId: string;
    expectedRevision: number | null;
    instruction: string;
  }>): Promise<Readonly<{
    revision: number;
    instruction: string;
    expiresAt: string;
  }>>;
  clear(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    seatId: string;
    expectedRevision: number;
  }>): Promise<Readonly<{
    revision: number;
    instruction: null;
    expiresAt: null;
  }>>;
}

function bounded(value: string, name: string, max = 2000): string {
  if (typeof value !== "string") throw new TypeError(`${name} is invalid`);
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function id(value: string, name: string): string {
  return bounded(value, name, 256);
}

function date(value: string, name: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed;
}

function assertOwnedTwinSeat(
  seat: DirectTwinSeatRecord | null,
  identity: PlatformSessionIdentity,
): DirectTwinSeatRecord {
  if (!seat) throw new Error("Direct Twin seat was not found");
  if (seat.tenantId !== identity.tenantId) {
    throw new Error("Direct Twin seat is outside the current tenant");
  }
  if (seat.kind !== "twin") throw new Error("Only Twin Seats can be directed");
  if (!seat.admitted || seat.removed) {
    throw new Error("Twin Seat is not active");
  }
  if (!seat.ownerUserId || seat.ownerUserId !== identity.userId) {
    throw new Error("Only the Twin owner can direct this Seat");
  }
  return seat;
}

export function createDirectTwinService(input: Readonly<{
  repository: DirectTwinRepository;
  authorizer: DirectTwinAuthorizer;
  now?: () => Date;
  ttlMs?: number;
}>): DirectTwinService {
  const now = input.now ?? (() => new Date());
  const ttlMs = input.ttlMs ?? 5 * 60 * 1000;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 10_000 || ttlMs > 30 * 60 * 1000) {
    throw new RangeError("Direct Twin instruction TTL is invalid");
  }

  async function scope(
    authorizationHeader: string | undefined,
    talkId: string,
    seatId: string,
  ) {
    const identity = await input.authorizer.authorize({ authorizationHeader });
    const normalizedTalkId = id(talkId, "talkId");
    const normalizedSeatId = id(seatId, "seatId");
    const seat = assertOwnedTwinSeat(
      await input.repository.readSeat({
        tenantId: identity.tenantId,
        talkId: normalizedTalkId,
        seatId: normalizedSeatId,
      }),
      identity,
    );
    return { identity, seat, talkId: normalizedTalkId, seatId: normalizedSeatId };
  }

  return Object.freeze<DirectTwinService>({
    async mine(request) {
      const identity = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const talkId = id(request.talkId, "talkId");
      const seats = await input.repository.listOwnedTwinSeats({
        tenantId: identity.tenantId,
        talkId,
        ownerUserId: identity.userId,
      });
      return Object.freeze(
        seats
          .filter((seat) => seat.kind === "twin" && seat.admitted && !seat.removed)
          .map((seat) => Object.freeze({ seatId: seat.seatId, personaId: seat.personaId })),
      );
    },

    async read(request) {
      const { identity, seat, talkId, seatId } = await scope(
        request.authorizationHeader,
        request.talkId,
        request.seatId,
      );
      const record = await input.repository.readInstruction({
        tenantId: identity.tenantId,
        talkId,
        seatId,
      });
      if (!record) {
        return Object.freeze({
          revision: 0,
          instruction: null,
          expiresAt: null,
        });
      }
      if (
        record.ownerUserId !== identity.userId ||
        record.personaId !== seat.personaId
      ) {
        throw new Error("Direct Twin store returned out-of-scope instruction");
      }
      const current = now();
      const expired =
        record.expiresAt !== null &&
        date(record.expiresAt, "expiresAt").getTime() <= current.getTime();
      return Object.freeze({
        revision: record.revision,
        instruction: expired ? null : record.instruction,
        expiresAt: expired ? null : record.expiresAt,
      });
    },

    async set(request) {
      const { identity, seat, talkId, seatId } = await scope(
        request.authorizationHeader,
        request.talkId,
        request.seatId,
      );
      const instruction = bounded(request.instruction, "instruction", 2000);
      const current = now();
      const expiresAt = new Date(current.getTime() + ttlMs).toISOString();
      const saved = await input.repository.writeInstruction({
        tenantId: identity.tenantId,
        talkId,
        seatId,
        personaId: seat.personaId,
        ownerUserId: identity.userId,
        expectedRevision: request.expectedRevision,
        instruction,
        updatedAt: current.toISOString(),
        expiresAt,
      });
      if (saved.ownerUserId !== identity.userId || saved.personaId !== seat.personaId) {
        throw new Error("Direct Twin store changed instruction ownership");
      }
      return Object.freeze({
        revision: saved.revision,
        instruction,
        expiresAt,
      });
    },

    async clear(request) {
      const { identity, seat, talkId, seatId } = await scope(
        request.authorizationHeader,
        request.talkId,
        request.seatId,
      );
      if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1) {
        throw new RangeError("expectedRevision is invalid");
      }
      const current = now().toISOString();
      const saved = await input.repository.writeInstruction({
        tenantId: identity.tenantId,
        talkId,
        seatId,
        personaId: seat.personaId,
        ownerUserId: identity.userId,
        expectedRevision: request.expectedRevision,
        instruction: null,
        updatedAt: current,
        expiresAt: null,
      });
      return Object.freeze({
        revision: saved.revision,
        instruction: null,
        expiresAt: null,
      });
    },
  });
}

export async function readDirectTwinInstructionForWorker(input: Readonly<{
  repository: DirectTwinRepository;
  tenantId: string;
  talkId: string;
  seatId: string;
  ownerUserId: string;
  personaId: string;
  now?: () => Date;
}>): Promise<string | null> {
  const record = await input.repository.readInstruction({
    tenantId: id(input.tenantId, "tenantId"),
    talkId: id(input.talkId, "talkId"),
    seatId: id(input.seatId, "seatId"),
  });
  if (!record || record.instruction === null) return null;
  if (
    record.ownerUserId !== input.ownerUserId ||
    record.personaId !== input.personaId
  ) {
    return null;
  }
  if (
    record.expiresAt !== null &&
    date(record.expiresAt, "expiresAt").getTime() <= (input.now ?? (() => new Date()))().getTime()
  ) {
    return null;
  }
  return record.instruction;
}
