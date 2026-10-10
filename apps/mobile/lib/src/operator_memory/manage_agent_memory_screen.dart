import 'package:flutter/material.dart';
import 'agent_memory_controller.dart';

/// Nested Assistant settings. F12 mounts it only after authenticated API and
/// canonical approval composition, never as a sixth tab.
class ManageAgentMemoryScreen extends StatefulWidget {
  const ManageAgentMemoryScreen({super.key, required this.controller, this.onApprovalRequired});
  final AgentMemoryController controller;
  final Future<void> Function(String operationId)? onApprovalRequired;
  @override
  State<ManageAgentMemoryScreen> createState() => _ManageAgentMemoryScreenState();
}

class _ManageAgentMemoryScreenState extends State<ManageAgentMemoryScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_updated);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.controller.refresh();
    });
  }
  void _updated() { if (mounted) setState(() {}); }

  @override
  void didUpdateWidget(covariant ManageAgentMemoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_updated);
      widget.controller.addListener(_updated);
      widget.controller.refresh();
    }
  }
  @override
  void dispose() {
    widget.controller.removeListener(_updated);
    super.dispose();
  }

  Future<String?> _editText({String initial = ''}) async {
    final input = TextEditingController(text: initial);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(initial.isEmpty ? 'Remember something' : 'Correct memory'),
        content: TextField(
          controller: input, maxLength: 512, minLines: 2, maxLines: 5,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Only information you want the assistant to remember',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, input.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    input.dispose();
    return result == null || result.isEmpty ? null : result;
  }
  Future<void> _remember() async {
    final content = await _editText();
    if (content != null) await widget.controller.remember('preference', content);
  }
  Future<void> _correct(AgentMemoryEntry entry) async {
    final next = await _editText(initial: entry.content);
    if (next != null && next != entry.content) await widget.controller.correct(entry, next);
  }
  Future<void> _forget(AgentMemoryEntry entry) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Forget this information?'),
        content: const Text('Secure confirmation is required. Preparing it does not delete anything.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Continue')),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    final operationId = await widget.controller.prepareForget(entry);
    if (!mounted || operationId == null) return;
    if (widget.onApprovalRequired != null) {
      await widget.onApprovalRequired!(operationId);
      if (mounted) await widget.controller.refresh();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Secure confirmation is unavailable. Nothing was deleted.'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.controller;
    final disabled = state.busy || state.consentState == null;
    return Scaffold(
      appBar: AppBar(title: const Text('Manage assistant memory'), actions: [
        IconButton(icon: const Icon(Icons.refresh), tooltip: 'Refresh private memory',
          onPressed: state.busy ? null : state.refresh),
      ]),
      body: SafeArea(child: ListView(children: [
        const ListTile(
          leading: Icon(Icons.lock_outline),
          title: Text('Private and optional'),
          subtitle: Text('Only what you explicitly save can be remembered. No automatic human chat, audio or payment collection. Turning this off stops assistant recall but keeps review available.'),
        ),
        if (state.busy) const LinearProgressIndicator(),
        if (state.error != null) ListTile(
          leading: const Icon(Icons.error_outline),
          title: Text(state.error!, maxLines: 3),
          trailing: TextButton(onPressed: state.busy ? null : state.refresh, child: const Text('Retry')),
        ),
        SwitchListTile(
          title: const Text('Allow assistant to use saved memory'),
          subtitle: Text(state.consentState == null ? 'Checking your preference…'
            : state.enabled ? 'On · you can turn this off' : 'Off · assistant recall blocked'),
          value: state.enabled, onChanged: disabled ? null : state.optIn,
        ),
        const Divider(),
        ListTile(
          title: const Text('Saved information'),
          subtitle: Text(state.entries.isEmpty ? 'No saved items' : state.entries.length.toString() + ' saved items'),
          trailing: FilledButton.icon(onPressed: (!state.enabled || state.busy) ? null : _remember,
            icon: const Icon(Icons.add), label: const Text('Remember')),
        ),
        for (final entry in state.entries) ListTile(
          key: ValueKey(entry.id),
          title: Text(entry.content, maxLines: 4, overflow: TextOverflow.ellipsis),
          subtitle: Text(entry.kind.replaceAll('-', ' ') + ' · expires ' +
            (entry.expiresAt?.toLocal().toString().split(' ').first ?? 'never')),
          trailing: PopupMenuButton<String>(
            tooltip: 'Memory actions', enabled: !state.busy,
            onSelected: (action) {
              if (action == 'correct') _correct(entry);
              if (action == 'forget') _forget(entry);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'correct', child: Text('Correct')),
              PopupMenuItem(value: 'forget', child: Text('Forget securely')),
            ],
          ),
        ),
      ])),
    );
  }
}
