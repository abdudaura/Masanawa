import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/admin_agent_chat_api.dart';
import '../core/admin_api.dart';
import '../theme/masanawa_theme.dart';

class AdminAgentsPage extends StatefulWidget {
  const AdminAgentsPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<AdminAgentsPage> createState() => _AdminAgentsPageState();
}

class _AdminAgentsPageState extends State<AdminAgentsPage> {
  late Future<List<AdminAgentDelegate>> _future = widget.api.adminDelegates();

  @override
  Widget build(BuildContext context) => FutureBuilder<List<AdminAgentDelegate>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(snapshot.error.toString(), textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () =>
                          setState(() => _future = widget.api.adminDelegates()),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }
          final delegates = snapshot.data ?? const <AdminAgentDelegate>[];
          return RefreshIndicator(
            onRefresh: () async {
              final next = widget.api.adminDelegates();
              setState(() => _future = next);
              await next;
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Admin agents',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  'Talk to delegated Masanawa Characters such as Gwani. '
                  'Their authority is controlled by Ops, not by the prompt.',
                  style: TextStyle(color: context.masanawa.textMuted),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.security_outlined),
                    title: const Text('Delegated control'),
                    subtitle: const Text(
                      'Read actions may be autonomous when allowed. '
                      'Administrative writes require an approval boundary.',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                if (delegates.isEmpty)
                  const Card(
                    child: ListTile(
                      title: Text('No admin agents configured'),
                      subtitle: Text(
                        'Configure approved admin Character IDs in '
                        'MASANAWA_OPS_AGENT_DELEGATES_JSON.',
                      ),
                    ),
                  )
                else
                  ...delegates.map(
                    (delegate) => Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor:
                                      context.masanawa.surfaceMuted,
                                  child: Icon(
                                    Icons.smart_toy_outlined,
                                    color: context.masanawa.brand,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        delegate.displayName ?? delegate.label,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium,
                                      ),
                                      Text(
                                        delegate.ready
                                            ? delegate.purpose
                                            : 'Character presentation is not ready · ${delegate.purpose}',
                                        style: TextStyle(
                                          color: context.masanawa.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                Chip(label: Text(delegate.autonomy)),
                                Chip(
                                  label: Text(
                                    '${delegate.capabilities.length} capabilities',
                                  ),
                                ),
                                if (delegate.approvalRequiredForWrites)
                                  const Chip(
                                    avatar:
                                        Icon(Icons.approval_outlined, size: 18),
                                    label: Text('Writes need approval'),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            FilledButton.icon(
                              onPressed: delegate.ready
                                  ? () => Navigator.of(context).push(
                                        MaterialPageRoute<void>(
                                          builder: (_) => AdminAgentChatScreen(
                                            api: widget.api,
                                            delegate: delegate,
                                          ),
                                        ),
                                      )
                                  : null,
                              icon: const Icon(Icons.chat_bubble_outline),
                              label: Text(
                                'Talk to ${delegate.displayName ?? delegate.label}',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      );
}

class _ChatMessage {
  const _ChatMessage({required this.text, required this.fromAgent});
  final String text;
  final bool fromAgent;
}

class AdminAgentChatScreen extends StatefulWidget {
  const AdminAgentChatScreen({
    super.key,
    required this.api,
    required this.delegate,
  });

  final AdminApi api;
  final AdminAgentDelegate delegate;

  @override
  State<AdminAgentChatScreen> createState() => _AdminAgentChatScreenState();
}

class _AdminAgentChatScreenState extends State<AdminAgentChatScreen> {
  late final AdminAgentConversationApi _conversation =
      AdminAgentConversationApi(adminApi: widget.api);
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final List<_ChatMessage> _messages = [];

  String? _sessionId;
  bool _busy = false;
  String? _error;

  Future<String> _ensureSession() async {
    final existing = _sessionId;
    if (existing != null) return existing;
    final created = await _conversation.open(widget.delegate.characterId);
    _sessionId = created;
    return created;
  }

  Future<void> _runReadAction(
    String action,
    String label,
  ) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.api.runDelegatedAdminAction(
        characterId: widget.delegate.characterId,
        action: action,
      );
      final body = result.completed
          ? const JsonEncoder.withIndent('  ').convert(result.data)
          : 'Approval required: ${result.reason ?? result.capability ?? 'unknown'}';
      if (mounted) {
        setState(() {
          _messages.add(
            _ChatMessage(
              text: 'Verified admin tool · $label\n$body',
              fromAgent: true,
            ),
          );
        });
        _scrollToEnd();
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send() async {
    final text = _composer.text.trim();
    if (text.isEmpty || _busy) return;
    setState(() {
      _messages.add(_ChatMessage(text: text, fromAgent: false));
      _composer.clear();
      _busy = true;
      _error = null;
    });
    _scrollToEnd();

    try {
      final sessionId = await _ensureSession();
      final result = await _conversation.send(
        characterId: widget.delegate.characterId,
        characterSessionId: sessionId,
        text: text,
      );
      if (mounted) {
        setState(() {
          _messages.add(
            _ChatMessage(
              text: result.reply,
              fromAgent: true,
            ),
          );
        });
        _scrollToEnd();
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void dispose() {
    final session = _sessionId;
    if (session != null) {
      _conversation.close(
        characterId: widget.delegate.characterId,
        characterSessionId: session,
      );
    }
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.delegate.label)),
        body: Column(
          children: [
            Material(
              color: context.masanawa.surfaceMuted,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.admin_panel_settings_outlined,
                      color: context.masanawa.brand,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Admin conversation · ${widget.delegate.autonomy}. '
                        'This Character can reason and advise now. '
                        'Administrative writes will only execute after the '
                        'delegated tool/approval gate accepts them.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Row(
                children: [
                  if (widget.delegate.capabilities
                      .contains('platform.summary.read'))
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ActionChip(
                        avatar: const Icon(Icons.dashboard_outlined, size: 18),
                        label: const Text('Inspect platform'),
                        onPressed: _busy
                            ? null
                            : () => _runReadAction(
                                  'platform.summary',
                                  'Platform summary',
                                ),
                      ),
                    ),
                  if (widget.delegate.capabilities
                      .contains('identity.users.read'))
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ActionChip(
                        avatar: const Icon(Icons.people_outline, size: 18),
                        label: const Text('Inspect users'),
                        onPressed: _busy
                            ? null
                            : () => _runReadAction('users.list', 'Users'),
                      ),
                    ),
                  if (widget.delegate.capabilities
                      .contains('operations.read'))
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ActionChip(
                        avatar: const Icon(Icons.rule_outlined, size: 18),
                        label: const Text('Inspect operations'),
                        onPressed: _busy
                            ? null
                            : () => _runReadAction(
                                  'operations.list',
                                  'Operations',
                                ),
                      ),
                    ),
                  if (widget.delegate.capabilities.contains('audit.read'))
                    ActionChip(
                      avatar: const Icon(Icons.fact_check_outlined, size: 18),
                      label: const Text('Inspect audit'),
                      onPressed: _busy
                          ? null
                          : () => _runReadAction('audit.list', 'Audit'),
                    ),
                ],
              ),
            ),
            Expanded(
              child: _messages.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Tell ${widget.delegate.label} what you want to inspect, '
                          'plan, or administer.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: context.masanawa.textMuted),
                        ),
                      ),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        final message = _messages[index];
                        return Align(
                          alignment: message.fromAgent
                              ? Alignment.centerLeft
                              : Alignment.centerRight,
                          child: Container(
                            constraints: const BoxConstraints(maxWidth: 640),
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: message.fromAgent
                                  ? context.masanawa.surfaceMuted
                                  : context.masanawa.brand.withValues(alpha: .12),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(message.text),
                          ),
                        );
                      },
                    ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  _error!,
                  style: TextStyle(color: context.masanawa.emergency),
                ),
              ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _composer,
                        enabled: !_busy,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: const InputDecoration(
                          hintText: 'Tell the admin agent what to do…',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _busy ? null : _send,
                      icon: _busy
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}
