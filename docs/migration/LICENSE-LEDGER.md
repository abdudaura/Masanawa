# License and Provenance Ledger

This is an engineering record, not legal advice.

## Baseline source licenses

| Source | License at pinned baseline | Default Masanawa policy |
|---|---|---|
| OpenJarvis | Apache-2.0 | concepts freely studied; direct code adaptation permitted only with required notices/provenance |
| N.E.K.O | Apache-2.0 | concepts freely studied; direct code adaptation permitted only with required notices/provenance |
| CyberVerse | GPLv3 | architecture/behavior study by default; no direct core code copy without explicit licensing ADR/review |
| ChatWithStars | privately owned by repository owner | may be redesigned/reused, but still track provenance for migration clarity |

## Direct adaptation record template

For every directly adapted external code section record:
- Masanawa destination;
- source repository;
- source path;
- source commit;
- original license;
- whether modified;
- required attribution/NOTICE;
- reviewer;
- date.

## Clean implementation rule

For GPL-sensitive CyberVerse concepts:
1. record behavior/architecture in ledgers;
2. define Masanawa contract independently;
3. implement against the contract without copying source text/code;
4. test behavior from independently described fixtures;
5. keep provenance note stating CyberVerse was an architecture reference.

If a future decision deliberately runs GPL-derived code as a separate component, record an ADR defining distribution/deployment and compliance implications before implementation.
