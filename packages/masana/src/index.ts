export type MasanaRevisionState = "draft" | "approved" | "retired";
export interface MasanaProfile {
  readonly handle: string;
  readonly displayName: string;
  readonly profession: string;
  readonly biography: string;
  readonly lifeStory: string;
  readonly languages: readonly string[];
  readonly talents: readonly string[];
  readonly goals: readonly string[];
  readonly roomId: string | null;
  readonly portraitMediaId: string | null;
  readonly bannerMediaId: string | null;
}
export interface PublishedMasana {
  readonly characterId: string;
  readonly revision: number;
  readonly profile: MasanaProfile;
  readonly followerCount: number;
  readonly following: boolean;
}
/** One canonical profile contract; no human, clone, or legacy Twin projection. */
export function validateMasanaProfile(value: unknown): MasanaProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("invalid_profile");
  }
  const p = value as Record<string, unknown>;
  const field = (key: string, max: number) => {
    const v = p[key];
    if (typeof v !== "string" || !v.trim() || v.length > max ||
        /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(v)) {
      throw new TypeError("invalid_" + key);
    }
    return v.trim();
  };
  const list = (key: string) => {
    const raw = p[key];
    if (!Array.isArray(raw) || raw.length > 20) throw new TypeError("invalid_" + key);
    return Object.freeze(raw.map((v: unknown) => {
      if (typeof v !== "string" || !v.trim() || v.length > 120 ||
          /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(v))
        throw new TypeError("invalid_" + key);
      return v.trim();
    })) as readonly string[];
  };
  const maybe = (key: string) => {
    const v = p[key];
    if (v === null || v === undefined) return null;
    if (typeof v !== "string" || v.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(v))
      throw new TypeError("invalid_" + key);
    return v;
  };
  const handle = field("handle", 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(handle)) throw new TypeError("invalid_handle");
  return Object.freeze({
    handle,
    displayName: field("displayName", 100),
    profession: field("profession", 100),
    biography: field("biography", 800),
    lifeStory: field("lifeStory", 8000),
    languages: list("languages"),
    talents: list("talents"),
    goals: list("goals"),
    roomId: maybe("roomId"),
    portraitMediaId: maybe("portraitMediaId"),
    bannerMediaId: maybe("bannerMediaId"),
  });
}
