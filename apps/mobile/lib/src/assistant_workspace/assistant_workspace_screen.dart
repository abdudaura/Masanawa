import 'dart:async';

import 'package:flutter/material.dart';

import '../agents/agent_directory.dart';
import '../agents/agent_session.dart';
import '../agents/agent_shell.dart';
import 'assistant_workspace_controller.dart';
import 'secure_assistant_pending_journal.dart';

/// Isolated C07 workspace ready for the single R17/C08 /assistant route.
/// This does not own shared tabs or start the microphone automatically.
class AssistantWorkspaceScreen extends StatefulWidget {
  const AssistantWorkspaceScreen({
    super.key,
    required this.ownerId,
    required this.directory,
    required this.agents,
    required this.shell,
    this.journal = const SecureAssistantPendingJournal(),
    this.onStartNativeVoice,
  });

  final String ownerId;
  final AgentDirectoryTransport directory;
  final AgentTransport agents;
  final AgentShellTransport shell;
  final AssistantPendingJournal journal;

  /// R02/R17 must supply only an already-authorized native Gemini Live entry.
  /// No voice control is rendered until a real implementation is attached.
  final VoidCallback? onStartNativeVoice;

  @override
  State<AssistantWorkspaceScreen> createState() =>
      _AssistantWorkspaceScreenState();
}

class _AssistantWorkspaceScreenState extends State<AssistantWorkspaceScreen> {
  late AssistantWorkspaceController workspace;
  final input = TextEditingController();
  final scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    workspace = _createController();
    workspace.addListener(_updated);
    scheduleMicrotask(workspace.load);
  }

  AssistantWorkspaceController _createController() =>
      AssistantWorkspaceController(
        ownerId: widget.ownerId,
        directory: widget.directory,
        agents: widget.agents,
        shell: widget.shell,
        journal: widget.journal,
      );

  @override
  void didUpdateWidget(covariant AssistantWorkspaceScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ownerId != widget.ownerId ||
        oldWidget.directory != widget.directory ||
        oldWidget.agents != widget.agents ||
        oldWidget.shell != widget.shell ||
        oldWidget.journal != widget.journal) {
      workspace.removeListener(_updated);
      workspace.dispose();
      input.clear();
      workspace = _createController();
      workspace.addListener(_updated);
      scheduleMicrotask(workspace.load);
    }
  }

  void _updated() {
    if (mounted) setState(() {});
  }

  Future<void> _send() async {
    final text = input.text;
    final owner = workspace.ownerId;
    if (text.trim().isEmpty || !workspace.canSend) return;
    await workspace.sendText(text);
    if (!mounted || workspace.ownerId != owner || input.text != text) return;
    // Only clear after secure persistence or a confirmed server acknowledgement;
    // failed protected writes leave the unsent composition editable.
    if (workspace.pending != null ||
        workspace.notice == 'Server acknowledged your message.' ||
        workspace.notice == 'Sent; history will refresh when connectivity returns.') {
      input.clear();
    }
  }

  Future<void> _discardPending() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Stop retrying this message?'),
        content: const Text(
          'The server may still finish an earlier attempt. Check message '
          'history before sending it again to avoid duplicates.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep pending')),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Stop retrying')),
        ],
      ),
    );
    if (confirmed == true) await workspace.dismissPending();
  }

  @override
  void dispose() {
    workspace.removeListener(_updated);
    workspace.dispose();
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final role = workspace.activeRole;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(role == null ? 'Assistant' : role.label),
            const Text('Private AI assistant',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          if (workspace.ready)
            PopupMenuButton<AssistantRole>(
              tooltip: 'Switch assistant',
              enabled: !workspace.busy && workspace.pending == null,
              icon: const Icon(Icons.swap_horiz),
              onSelected: (next) => unawaited(workspace.switchTo(next)),
              itemBuilder: (_) => [
                for (final item in AssistantRole.values)
                  PopupMenuItem(
                    value: item,
                    child: Row(children: [
                      if (role == item) const Icon(Icons.check, size: 18),
                      const SizedBox(width: 8),
                      Text('Switch to ' + item.label),
                    ]),
                  ),
              ],
            ),
          IconButton(
            tooltip: 'Refresh authorized history',
            onPressed: workspace.ready && !workspace.busy
                ? () => unawaited(workspace.refreshHistory()) : null,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(children: [
          if (workspace.busy) const LinearProgressIndicator(),
          if (workspace.error != null)
            MaterialBanner(
              content: Text(workspace.error!),
              actions: [
                TextButton(
                  onPressed: workspace.busy ? null : () => unawaited(workspace.load()),
                  child: const Text('Retry'),
                ),
              ],
            ),
          if (workspace.notice != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Text(workspace.notice!, semanticsLabel: workspace.notice!),
            ),
          if (workspace.pending != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Pending to ' + workspace.pending!.role.label,
                        style: Theme.of(context).textTheme.labelLarge),
                    Text(workspace.pending!.text,
                        maxLines: 3, overflow: TextOverflow.ellipsis),
                    const Text('Not yet confirmed delivered'),
                    Row(children: [
                      TextButton(
                        onPressed: workspace.busy
                            ? null : () => unawaited(workspace.retryPending()),
                        child: const Text('Check / retry'),
                      ),
                      TextButton(
                        onPressed: workspace.busy
                            ? null : () => unawaited(_discardPending()),
                        child: const Text('Stop retrying'),
                      ),
                    ]),
                  ],
                ),
              ),
            ),
          Expanded(
            child: !workspace.ready && workspace.history.isEmpty
                ? Center(
                    child: Text(workspace.busy
                        ? 'Loading your private Assistant…'
                        : 'Assistant not available. Retry after signing in.'),
                  )
                : ListView.builder(
                    controller: scroll,
                    key: ValueKey('assistant-' + widget.ownerId),
                    itemCount: workspace.history.length,
                    itemBuilder: (context, i) {
                      final item = workspace.history[i];
                      final isUser = item.message.direction == 'user';
                      return Semantics(
                        label: (isUser ? 'You' : item.role.label + ' AI')
                            + ', message',
                        child: Align(
                          alignment: isUser
                              ? Alignment.centerRight : Alignment.centerLeft,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 330),
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(isUser ? 'You' : item.role.label + ' · AI',
                                        style: Theme.of(context).textTheme.labelSmall),
                                    SelectableText(item.message.text),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
            child: Row(children: [
              if (widget.onStartNativeVoice != null)
                IconButton(
                  tooltip: 'Start private native voice',
                  onPressed: workspace.canSend
                      ? widget.onStartNativeVoice : null,
                  icon: const Icon(Icons.mic),
                ),
              Expanded(
                child: TextField(
                  controller: input,
                  enabled: workspace.ready,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 6000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: role == null
                        ? 'Message Assistant' : 'Message ' + role.label,
                    border: const OutlineInputBorder(),
                    counterText: '',
                  ),
                  onSubmitted: (_) => unawaited(_send()),
                ),
              ),
              IconButton(
                tooltip: 'Send message',
                onPressed: workspace.canSend
                    ? () => unawaited(_send()) : null,
                icon: const Icon(Icons.send),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
