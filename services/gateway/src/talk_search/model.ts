import type { TalkDiscoveryItem } from "../talks/model.js";

export type TalkSearchType = "all" | "talks" | "people" | "experts" | "twins";
export type TalkSearchPersonaKind = "expert" | "twin";

export interface TalkSearchPerson {
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly isLive: boolean;
  readonly liveTalkId: string | null;
}

export interface TalkSearchPersona {
  readonly publicId: string;
  readonly displayName: string;
  readonly kind: TalkSearchPersonaKind;
  readonly seatFeeLabel: string;
  readonly isAvailable: boolean;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly isVerified: boolean;
}

export interface TalkSearchResults {
  readonly talks: readonly TalkDiscoveryItem[];
  readonly people: readonly TalkSearchPerson[];
  readonly personas: readonly TalkSearchPersona[];
}

export interface TalkSearchRepository {
  searchTalks(input: Readonly<{
    tenantId: string;
    query: string;
    limit: number;
  }>): Promise<readonly TalkDiscoveryItem[]>;

  searchPeople(input: Readonly<{
    tenantId: string;
    query: string;
    limit: number;
  }>): Promise<readonly TalkSearchPerson[]>;

  searchPersonas(input: Readonly<{
    tenantId: string;
    query: string;
    kind?: TalkSearchPersonaKind;
    limit: number;
  }>): Promise<readonly TalkSearchPersona[]>;
}
