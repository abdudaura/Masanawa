# External MCP/A2A protocol bridge pattern — Task 141

Status: **SUPERSEDED / DO NOT INTEGRATE**

This branch was claimed and implemented during a concurrency race, but PR #271
(`work/plugin-protocol-bridges-20261006`) appeared as the earlier canonical Task 141
owner and already covers the same protocol-bridge boundary on top of Task 140.

To preserve single-owner coordination:
- do not open or merge a PR from `work/plugin-protocol-bridge-20261006`;
- do not treat `packages/plugins/src/bridge.ts` or its tests on this branch as canonical;
- continue Task 141 integration only through PR #271 and its handoff;
- this branch is retained only as non-authoritative reference/history.

Superseded on 2026-10-06 after ownership re-scan.
