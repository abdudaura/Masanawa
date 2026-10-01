# Mem0 Memory Authority Map

Status: COMPLETE FOR PHASE 0B

| Mem0 state/mechanism | Evidence | Masanawa owner | Treatment |
|---|---|---|---|
| user_id / agent_id / run_id scope | `mem0/memory/main.py`, session-scope tests | packages/memory + security | preserve typed-scope discipline; replace donor identifiers with canonical MemoryScope |
| actor_id and identity metadata | identity-key stripping/pinning paths | packages/memory + security | caller metadata never authorizes or moves memory scope |
| vector-store memory row | `mem0/vector_stores/**` | packages/memory canonical persistence + retrieval projection | vector row is rebuildable projection, never canonical record |
| SQLite history DB | `mem0/memory/storage.py` | MemoryRevision + AuditEvent | preserve successful-mutation-before-history ordering; replace storage |
| entity vector collection | entity extraction/linking paths | MemoryEntityProjection | rebuildable; deletion/relink follows canonical record lifecycle |
| BM25/scoring candidates | `mem0/utils/scoring.py`, lemmatization | MemoryRetrievalCandidate | ephemeral query projection after scope authorization |
| reranker result | `mem0/reranker/**` | memory retrieval compiler | optional ranking stage; fallback preserves candidates/top-k |
| expiration_date | Python/TS expiration paths | MemoryExpirationPolicy | validity/visibility state, not deletion/tombstone |
| provider configurations | LLM/embedder/reranker/vector configs | packages/providers | adapter config only; secrets and activation belong to canonical provider registry |
| self-hosted server users/API keys | `server/auth.py`, DB migrations | security/auth | reference patterns only; never Masanawa identity authority |
| plugin user/scope IDs | `integrations/**` | plugin adapter + canonical auth | adapters receive authorized scope; they do not invent it |

## Canonical order

1. authorize tenant/Character/relationship/shared/world scope;
2. persist foreground evidence before asynchronous cognition where applicable;
3. extract candidate facts with provider outcome recorded;
4. compare/deduplicate against already-authorized related memories;
5. commit canonical MemoryRecord/MemoryRevision state;
6. append mutation/audit evidence;
7. update vector, lexical, entity and temporal projections asynchronously;
8. retrieve only from authorized scope, then fuse semantic/lexical/entity/temporal signals;
9. rerank optionally with fail-soft fallback;
10. compile bounded working context with provenance.

Projection or provider failure may reduce recall quality but must not corrupt canonical records or widen visibility.
