import 'dart:async';

import 'package:flutter/material.dart';

import '../agents/agent_directory.dart';
import '../agents/agent_session.dart';
import '../agents/agent_shell.dart';
import 'assistant_workspace_controller.dart';
import '../services/private_service_intent.dart';
import '../screens/chat/private_service_intent_prompt.dart';
import 'assistant_draft_store.dart';
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
    this.drafts = const SecureAssistantDraftStore(),
    this.onStartNativeVoice,
    this.pendingServiceIntent,
    this.onServiceIntentConsumed,
    this.onOpenServiceEditor,
  });

  final PendingPrivateServiceIntent? pendingServiceIntent;
  final void Function(PendingPrivateServiceIntent)? onServiceIntentConsumed;
  final void Function(PendingPrivateServiceIntent)? onOpenServiceEditor;
  final String ownerId;
  final AgentDirectoryTransport directory;
  final AgentTransport agents;
  final AgentShellTransport shell;
  final AssistantPendingJournal journal;
  final AssistantDraftStore drafts;

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
  Timer? _draftTimer;
  Future<void> _draftWrites = Future<void>.value();
  int _draftGeneration = 0;
  String? _draftError;
  bool _suppressDraftSaves = false;

  @override
  void initState() {
    super.initState();
    workspace = _createController();
    workspace.addListener(_updated);
    input.addListener(_saveDraftDebounced);
    _restoreDraft(++_draftGeneration);
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
        oldWidget.journal != widget.journal ||
        oldWidget.drafts != widget.drafts) {
      _draftTimer?.cancel();
      ++_draftGeneration;
      workspace.removeListener(_updated);
      workspace.dispose();
      // Do not erase the new account's keystore draft while swapping widgets.
      _suppressDraftSaves = true;
      input.clear();
      _suppressDraftSaves = false;
      _draftError = null;
      workspace = _createController();
      workspace.addListener(_updated);
      _restoreDraft(_draftGeneration);
      scheduleMicrotask(workspace.load);
    }
  }

  void _updated() {
    if (mounted) setState(() {});
  }

  Future<void> _restoreDraft(int generation) async {
    final owner = widget.ownerId;
    try {
      final restored = await widget.drafts.read(owner);
      if (!mounted || generation != _draftGeneration ||
          widget.ownerId != owner || input.text.isNotEmpty) return;
      if (restored != null && restored.isNotEmpty) input.text = restored;
    } catch (_) {
      if (mounted && generation == _draftGeneration) {
        setState(() => _draftError =
            'Cannot restore your protected draft; other messages are unaffected.');
      }
    }
  }

  void _saveDraftDebounced() {
    if (_suppressDraftSaves) return;
    _draftTimer?.cancel();
    final owner = widget.ownerId;
    final store = widget.drafts;
    final captured = input.text;
    final generation = _draftGeneration;
    _draftTimer = Timer(const Duration(milliseconds: 350), () {
      // Serialize keystore writes: an older async write must never win over a
      // newer draft or the empty draft written after a confirmed send.
      _draftWrites = _draftWrites.then((_) =>
          store.write(owner, captured)).catchError((Object _) {
        if (mounted && generation == _draftGeneration &&
            widget.ownerId == owner) {
          setState(() => _draftError =
              'Draft could not be stored securely. Copy it before leaving.');
        }
      });
    });
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
    _draftTimer?.cancel();
    ++_draftGeneration;
    input.removeListener(_saveDraftDebounced);
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
      backgroundColor: Theme.of(context).brightness == Brightness.light
          ? const Color(0xFFEFEAE2)
          : const Color(0xFF111B21),
      body: SafeArea(
        child: Column(children: [
          if (widget.pendingServiceIntent?.belongsTo(widget.ownerId) == true)
            PrivateServiceIntentPrompt(
              key: ValueKey('assistant-service-' + widget.pendingServiceIntent!.revision.toString()),
              intent: widget.pendingServiceIntent!.intent,
              canContinue: workspace.canSend,
              onContinue: () async {
                final request = widget.pendingServiceIntent!;
                if (!workspace.canSend || !request.belongsTo(workspace.ownerId)) return;
                await workspace.sendText(request.intent.helpRequest);
                if (!mounted || !request.belongsTo(workspace.ownerId)) return;
                if (workspace.pending != null ||
                    workspace.notice == 'Server acknowledged your message.' ||
                    workspace.notice == 'Sent; history will refresh when connectivity returns.') {
                  widget.onServiceIntentConsumed?.call(request);
                } else {
                  throw StateError('Service request was not stored or acknowledged');
                }
              },
              onOpenEditor: () => widget.onOpenServiceEditor?.call(widget.pendingServiceIntent!),
              onDismiss: () => widget.onServiceIntentConsumed?.call(widget.pendingServiceIntent!),
            ),
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
          if (_draftError != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_draftError!, key: const ValueKey('draft-warning')),
            ),
          if (workspace.notice != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Text(workspace.notice!, semanticsLabel: workspace.notice!),
            ),
          if (workspace.pending != null && workspace.pending!.text.trim().isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                children: [
                  const Icon(Icons.schedule_rounded, size: 18, color: Colors.orange),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Pending to ' + workspace.pending!.role.label + ': ' + workspace.pending!.text,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: Colors.black87),
                    ),
                  ),
                  TextButton(
                    onPressed: workspace.busy ? null : () => unawaited(workspace.retryPending()),
                    child: const Text('Retry', style: TextStyle(fontSize: 12)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: workspace.busy ? null : () => unawaited(_discardPending()),
                  ),
                ],
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
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: workspace.history.length,
                    itemBuilder: (context, i) {
                      final isDark = Theme.of(context).brightness == Brightness.dark;
                      final item = workspace.history[i];
                      final isUser = item.message.direction == 'user';
                      return Semantics(
                        label: (isUser ? 'You' : item.role.label + ' AI')
                            + ', message',
                        child: Align(
                          alignment: isUser
                              ? Alignment.centerRight : Alignment.centerLeft,
                          child: ConstrainedBox(
                            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: isUser
                                    ? (isDark ? const Color(0xFF005C4B) : const Color(0xFFDCF8C6))
                                    : (isDark ? const Color(0xFF1F2C34) : Colors.white),
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(14),
                                  topRight: const Radius.circular(14),
                                  bottomLeft: Radius.circular(isUser ? 14 : 2),
                                  bottomRight: Radius.circular(isUser ? 2 : 14),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 2,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (!isUser) ...[
                                    Text(
                                      item.role.label + ' · AI',
                                      style: TextStyle(
                                        color: isDark ? const Color(0xFF25D366) : const Color(0xFF075E54),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                  ],
                                  SelectableText(
                                    item.message.text,
                                    style: TextStyle(
                                      fontSize: 15,
                                      color: isDark ? Colors.white : const Color(0xFF111827),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
            child: Row(children: [
              if (widget.onStartNativeVoice != null)
                IconButton(
                  tooltip: 'Start private native voice',
                  onPressed: workspace.canSend
                      ? widget.onStartNativeVoice : null,
                  icon: const Icon(Icons.mic, color: Color(0xFF128C7E)),
                ),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF1F2C34)
                        : Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 3,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
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
                      border: InputBorder.none,
                      counterText: '',
                    ),
                    onSubmitted: (_) => unawaited(_send()),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              CircleAvatar(
                radius: 22,
                backgroundColor: workspace.canSend ? const Color(0xFF128C7E) : Colors.grey.shade400,
                child: IconButton(
                  tooltip: 'Send message',
                  onPressed: workspace.canSend
                      ? () => unawaited(_send()) : null,
                  icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

