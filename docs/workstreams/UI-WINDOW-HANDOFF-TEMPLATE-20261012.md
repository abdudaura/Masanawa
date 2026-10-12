# UI milestone handoff format

Use this format inside the queue's exact per-milestone handoff path. Replace the descriptions with actual evidence; do not commit the template text as a completed milestone. Keep it concise, and link existing domain evidence instead of duplicating reports.

## Identity and current state

- Milestone ID/title; AF lead and claim ID.
- Inspected base SHA; feature branch/source SHA; PR URL; merged main SHA or explicitly unmerged.
- Implementation state; verification state per scope; release state per scope.
- Exact changed source/test paths; preserved newer branch work and shared-path transfers.

## Delivered behavior and acceptance

List each assigned acceptance, its open/closed state and the evidence that supports it. Include mounted route/API linkage where relevant. Distinguish functioning empty UI from genuinely empty backend data, loaded-page filtering from complete-history search, and source/widget behavior from installed/provider results.

## Executed checks

For each check record command/journey, exact SHA, result/count and scope. Name baseline failures, introduced regressions, skipped checks and unavailable tooling separately. Include real rendered viewport/device evidence for visual claims. Never treat previous-window results or authored tests as executed here.

## Remaining work and blockers

List unfinished requested behavior and external qualification separately. Each blocker names the exact missing source/interface/runner/authority, responsible lane and smallest next action. An unavailable runner does not imply other independent milestones must wait. Preserve uncertain financial obligations and server capability restrictions.

## Next continuation prompt

Print the full prompt directly for the owner as well as storing it here. Start with fresh origin/main and AGENTS.md/CONTINUE-HERE.md; retain `docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md`. Include this handoff path, delivered SHAs, preserved features, the preferred next milestone's concrete task, relevant tests/ownership and remaining external checks. End by requiring the next window to update its own handoff and print the next queue-aware prompt.

If fresh main already completes the preferred item, tell the next window to verify that evidence and select the next ready item. No receiving window is confirmed until a real claim/handoff establishes it.
