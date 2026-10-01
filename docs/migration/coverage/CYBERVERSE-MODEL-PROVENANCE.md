# CyberVerse Embedded Model Provenance Boundary

Pinned source: Lynpoint/CyberVerse@13a6a95b47e5e6f0809683458767746ad54d7d7f

Status: COMPLETE FOR PHASE 0B SOURCE-PIN REVIEW

CyberVerse is GPLv3, but its models/ tree contains copies or adaptations of separate upstream projects. Masanawa must not infer licensing from the parent repository in either direction.

## MuseTalk

Pinned tree evidence:
- models/MuseTalk/LICENSE exists.
- That file identifies MuseTalk code under MIT and separately lists MIT/Apache dependencies.
- The README points to upstream MuseTalk repositories/model weights.

Treatment:
- CyberVerse's copy remains GPL-context source and is not copied.
- MuseTalk may be evaluated directly from its upstream project under its own license in a future provider/model ADR.
- Model weights and every transitive dependency still require their own distribution/use review; the local MIT source license does not automatically license every downloaded checkpoint/data artifact.
- No CyberVerse modifications are assumed safe for direct reuse merely because upstream MuseTalk is MIT.

## SoulX-LiveAct

Pinned tree evidence:
- models/SoulX-LiveAct/README.md identifies the upstream SoulX-LiveAct project/checkpoints.
- No local LICENSE file exists under models/SoulX-LiveAct at the pinned revision.

Treatment:
- Rights for the vendored source/model are not established by the pinned CyberVerse tree.
- Keep as C/reference only.
- Any future adoption must start from the upstream project/model card and verify code license, weight license, dependencies and usage restrictions independently.
- No code or schema from the CyberVerse copy is imported.

## SoulX-FlashHead

Pinned tree evidence:
- models/flash_head/README.md identifies the upstream SoulX-FlashHead project and Hugging Face checkpoints.
- No local LICENSE file exists under models/flash_head at the pinned revision.

Treatment:
- Rights are not established by the pinned CyberVerse tree.
- Keep as C/reference only.
- Any future adoption must independently verify upstream code, model-weight, dataset and dependency licenses.
- No CyberVerse-local modifications are imported.

## Derived rule

An embedded third-party project is never approved merely because:
- the parent repository has a license;
- the embedded project has a README;
- its upstream repository is public;
- checkpoints are downloadable.

A future model/provider adoption record must identify:
1. exact upstream source and revision;
2. source-code license;
3. weight/model-card license;
4. dataset/use restrictions where relevant;
5. redistribution/hosting obligations;
6. third-party dependency notices;
7. whether Masanawa is importing code, invoking an external service, or using an independently packaged runtime.

This closes CyberVerse model provenance for the pinned source without making unsupported licensing assumptions.
