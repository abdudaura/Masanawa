import 'dart:async';
import 'package:flutter/material.dart';
import 'operator_task_center_controller.dart';
import 'operator_task_contract.dart';

/// Mounted only inside C07 Assistant by the elected R17/C08 integrator.
class OperatorTaskCenter extends StatefulWidget {
  const OperatorTaskCenter({
    super.key,
    required this.controller,
    this.onSecureApprovalReview,
    this.onEditPreparedDraft,
    this.onOpenVerifiedReceipt,
    this.onStartNewRequest,
    this.onReturnToOrigin,
    this.originLabel,
  });

  final OperatorTaskCenterController controller;
  /// External callback MUST load real canonical terms/nonce, and reauthorize.
  final Future<void> Function(OperatorTaskSnapshot)? onSecureApprovalReview;
  final Future<void> Function(OperatorTaskSnapshot)? onEditPreparedDraft;
  final Future<void> Function(OperatorTaskSnapshot)? onOpenVerifiedReceipt;
  final VoidCallback? onStartNewRequest;
  final VoidCallback? onReturnToOrigin;
  final String? originLabel;

  @override
  State<OperatorTaskCenter> createState() => _OperatorTaskCenterState();
}

class _OperatorTaskCenterState extends State<OperatorTaskCenter> {
  int section = 0;
  String? uiError;
  bool callbackBusy = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    scheduleMicrotask(widget.controller.refresh);
  }

  @override
  void didUpdateWidget(covariant OperatorTaskCenter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_changed);
      widget.controller.addListener(_changed);
      section = 0;
      uiError = null;
      scheduleMicrotask(widget.controller.refresh);
    }
  }

  void _changed() { if (mounted) setState(() {}); }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    super.dispose();
  }

  List<OperatorTaskSnapshot> get visible => switch (section) {
    0 => widget.controller.active,
    1 => widget.controller.needsApproval,
    _ => widget.controller.history,
  };

  Future<void> review(OperatorTaskSnapshot task) async {
    final action = widget.onSecureApprovalReview;
    if (action == null || callbackBusy) return;
    setState(() { callbackBusy = true; uiError = null; });
    try {
      final fresh = await widget.controller.getApprovalReview(task.taskId);
      if (!mounted || fresh == null) return;
      await action(fresh);
      if (mounted) await widget.controller.readback(fresh.taskId);
    } catch (_) {
      if (mounted) setState(() => uiError =
          'Secure approval was not confirmed. No approval is assumed.');
    } finally {
      if (mounted) setState(() => callbackBusy = false);
    }
  }

  Future<void> edit(OperatorTaskSnapshot task) async {
    final action = widget.onEditPreparedDraft;
    if (action == null || callbackBusy) return;
    setState(() { callbackBusy = true; uiError = null; });
    try {
      final fresh = await widget.controller.readback(task.taskId);
      if (!mounted || fresh?.phase != OperatorTaskPhase.prepared) return;
      await action(fresh!);
      if (mounted) await widget.controller.readback(task.taskId);
    } catch (_) {
      if (mounted) setState(() => uiError =
          'Draft changes were not confirmed by the server.');
    } finally {
      if (mounted) setState(() => callbackBusy = false);
    }
  }

  Future<void> cancel(OperatorTaskSnapshot task) async {
    if (callbackBusy || widget.controller.taskBusy(task.taskId)) return;
    final agreed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request cancellation?'),
        content: const Text(
          'Only the server can confirm cancellation. This cannot undo an '
          'already-sent message or completed payment.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep task')),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Request cancellation')),
        ],
      ),
    );
    if (mounted && agreed == true) await widget.controller.cancel(task.taskId);
  }

  Future<void> receipt(OperatorTaskSnapshot task) async {
    final action = widget.onOpenVerifiedReceipt;
    if (!task.hasVerifiedReceipt || action == null) return;
    try {
      final fresh = await widget.controller.readback(task.taskId);
      if (fresh != null && fresh.hasVerifiedReceipt) await action(fresh);
    } catch (_) {
      if (mounted) setState(() =>
          uiError = 'Receipt cannot be opened securely right now.');
    }
  }

  Widget taskCard(OperatorTaskSnapshot task) {
    final c = widget.controller;
    final disabled = callbackBusy || c.taskBusy(task.taskId);
    final selected = c.selectedId == task.taskId;
    return Card(
      key: ValueKey('task-' + task.taskId),
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(task.capabilityId,
              maxLines: 2, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall),
          Text(readableTaskPhase(task.phase)),
          if (task.isUncertain)
            const Text('Outcome not confirmed. Checking does not resend.'),
          if (task.needsApproval) ...[
            const Text('Review exact current terms in the secure workflow. '
                'A voice or chat yes never authorizes an action.'),
            if (task.approvalExpiresAt != null)
              Text('Deadline (device local time): ' +
                  task.approvalExpiresAt!.toLocal().toString()),
          ],
          if (task.errorCode != null)
            Text('Support code: ' + task.errorCode!),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 3, children: [
            OutlinedButton(
              onPressed: disabled ? null : () => c.inspect(task.taskId),
              child: Text(selected ? 'Refresh details' : 'Details'),
            ),
            OutlinedButton(
              onPressed: disabled ? null : () => c.readback(task.taskId),
              child: Text(task.isUncertain ? 'Check status' : 'Resume / refresh'),
            ),
            if (task.mayRequestCancel)
              TextButton(
                onPressed: disabled ? null : () => cancel(task),
                child: const Text('Cancel'),
              ),
            if (task.needsApproval &&
                widget.onSecureApprovalReview != null)
              FilledButton(
                onPressed: disabled ? null : () => review(task),
                child: const Text('Review exact terms'),
              ),
            if (task.phase == OperatorTaskPhase.prepared &&
                widget.onEditPreparedDraft != null)
              TextButton(
                onPressed: disabled ? null : () => edit(task),
                child: const Text('Edit draft'),
              ),
            if (task.hasVerifiedReceipt &&
                widget.onOpenVerifiedReceipt != null)
              TextButton(
                onPressed: disabled ? null : () => receipt(task),
                child: const Text('View receipt'),
              ),
            if (task.phase == OperatorTaskPhase.failed &&
                widget.onStartNewRequest != null)
              TextButton(
                onPressed: disabled ? null : widget.onStartNewRequest,
                child: const Text('Start new request'),
              ),
          ]),
          if (selected) ...[
            const Divider(),
            if (c.selectedEvents.isEmpty)
              const Text('Event history unavailable or not recorded yet.')
            else
              for (final event in c.selectedEvents)
                Semantics(
                  label: 'Task revision ' + event.version.toString() +
                      ': ' + readableTaskPhase(event.phase),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Text(event.version.toString() + '. ' +
                        readableTaskPhase(event.phase)),
                  ),
                ),
            TextButton(
              onPressed: c.closeDetails,
              child: const Text('Close details'),
            ),
          ],
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final rows = visible;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Row(children: [
          Expanded(child: Text('My tasks',
              style: Theme.of(context).textTheme.titleLarge)),
          IconButton(
            tooltip: 'Refresh task status',
            onPressed: c.busy || c.acting ? null : c.refresh,
            icon: const Icon(Icons.refresh),
          ),
          if (widget.onReturnToOrigin != null)
            TextButton(
              onPressed: widget.onReturnToOrigin,
              child: Text(widget.originLabel == null
                  ? 'Return' : 'Return to ' + widget.originLabel!),
            ),
        ]),
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(children: [
          for (final entry in const [
            (0, 'Active'), (1, 'Needs approval'), (2, 'History'),
          ])
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(entry.$2),
                selected: section == entry.$1,
                onSelected: (_) => setState(() => section = entry.$1),
              ),
            ),
        ]),
      ),
      if (c.busy) const LinearProgressIndicator(),
      if (uiError != null || c.error != null)
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text(uiError ?? c.error!,
              key: const Key('task-error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ),
      if (c.notice != null)
        Padding(
          padding: const EdgeInsets.all(8),
          child: Text(c.notice!),
        ),
      Expanded(
        child: !c.initialized && c.busy
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: c.refresh,
                child: ListView.builder(
                  key: ValueKey('task-section-' + section.toString()),
                  itemCount: rows.length + 1,
                  itemBuilder: (ctx, index) {
                    if (index < rows.length) return taskCard(rows[index]);
                    if (rows.isEmpty && (!c.hasMore || section == 0 && c.tasks.isEmpty)) {
                      return Padding(
                        padding: const EdgeInsets.all(28),
                        child: Text(c.error != null
                            ? 'Task status unavailable. Pull to retry.'
                            : 'No tasks in this section.',
                            textAlign: TextAlign.center),
                      );
                    }
                    if (!c.hasMore) {
                      return const SizedBox(height: 24);
                    }
                    return Center(child: TextButton(
                      onPressed: c.loadingMore ? null : c.loadMore,
                      child: Text(c.loadingMore
                          ? 'Loading history…' : 'Load older tasks'),
                    ));
                  },
                ),
              ),
      ),
    ]);
  }
}
