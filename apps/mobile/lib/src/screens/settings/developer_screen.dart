import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../agents/masanawa_transport.dart';
import '../../agents/agent_feedback.dart';
import '../../chat/message_parts.dart';
import '../../core/providers.dart';
import '../../state/agent_directory_state.dart';
import '../../state/agent_connection_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

class DeveloperScreen extends ConsumerStatefulWidget {
  const DeveloperScreen({super.key});

  @override
  ConsumerState<DeveloperScreen> createState() => _DeveloperScreenState();
}

class _DeveloperScreenState extends ConsumerState<DeveloperScreen> {
  bool _checking = false;
  String _health = 'Not checked';
  String _readiness = 'Not checked';
  final _gateway = TextEditingController();
  final _token = TextEditingController();
  bool _connecting = false;
  String? _connectionMessage;

  @override
  void initState() {
    super.initState();
    _gateway.text = ref.read(agentConnectionProvider).baseUrl;
  }

  @override
  void dispose() {
    _gateway.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    if (!kDebugMode || _connecting) return;
    setState(() {
      _connecting = true;
      _connectionMessage = null;
    });
    try {
      final connection = ref.read(agentConnectionProvider);
      final agents = await ref
          .read(agentConnectionProvider.notifier)
          .connect(
            baseUrl: _gateway.text,
            token: _token.text.trim().isEmpty
                ? connection.token ?? kAlphaDevAccessToken
                : _token.text,
            verify: (url, token) => MasanawaAgentDirectoryTransport(
              dio: ref.read(dioProvider),
              baseUrl: url,
              readAccessToken: () => token,
            ).loadDirectory(),
          );
      if (!mounted) return;
      _token.clear();
      setState(
        () => _connectionMessage = agents.isEmpty
            ? 'Connected. No agents are available for this account yet.'
            : 'Connected. ${agents.length} ${agents.length == 1 ? 'agent is' : 'agents are'} ready to open.',
      );
      // A connection change rebuilds the directory transport automatically.
      await _checkRuntime();
    } on FormatException catch (error) {
      if (mounted) {
        setState(() => _connectionMessage = error.message.toString());
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _connectionMessage = AgentFeedback.fromError(error).message,
        );
      }
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _checkRuntime() async {
    final connection = ref.read(agentConnectionProvider);
    if (!connection.configured) {
      setState(() {
        _health = 'Not configured';
        _readiness = 'Not configured';
      });
      return;
    }

    setState(() => _checking = true);
    final dio = ref.read(dioProvider);
    try {
      final health = await dio.get<Map<String, dynamic>>(
        '${connection.baseUrl}/healthz',
        options: Options(followRedirects: false),
      );
      final ready = await dio.get<Map<String, dynamic>>(
        '${connection.baseUrl}/readyz',
        options: Options(validateStatus: (_) => true, followRedirects: false),
      );
      if (!mounted) return;
      setState(() {
        _health =
            '${health.statusCode} · ${health.data?['status'] ?? 'unknown'}';
        _readiness =
            '${ready.statusCode} · ${ready.data?['status'] ?? 'unknown'}';
      });
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _health = 'Failed · ${error.type.name}';
        _readiness = 'Unavailable';
      });
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) {
      return const Scaffold(
        body: Center(child: Text('This page is unavailable.')),
      );
    }
    final u = context.masanawa;
    final connection = ref.watch(agentConnectionProvider);
    ref.listen(agentConnectionProvider, (previous, next) {
      if (previous?.restoring == true &&
          !next.restoring &&
          _gateway.text == previous!.baseUrl) {
        _gateway.text = next.baseUrl;
      }
    });
    final directory = ref.watch(agentDirectoryProvider);
    final chats = ref.watch(aiChatProvider);
    final session = ref.watch(sessionProvider);
    final token = session is SessionSignedIn
        ? session.tokens.accessToken
        : null;
    final scenarioAgent = directory.agents.isEmpty
        ? null
        : directory.agents.first;
    String? lastRun;
    for (final thread in chats.chatList) {
      if (thread.agentRunId != null) {
        lastRun = thread.agentRunId;
        break;
      }
    }

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Developer'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/settings'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Connect test app',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use the address and Alpha token from the same Gateway. Your laptop token and hosted token are different.',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _gateway,
                    enabled: !_connecting,
                    autocorrect: false,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Gateway HTTPS address',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _token,
                    enabled: !_connecting,
                    obscureText: true,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: InputDecoration(
                      labelText: 'Alpha access token',
                      helperText: connection.token == null
                          ? 'Stored securely after verification.'
                          : 'Leave blank to keep the saved token.',
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _connecting || connection.restoring
                        ? null
                        : _connect,
                    child: Text(_connecting ? 'Connecting…' : 'Connect'),
                  ),
                  if (_connectionMessage != null) ...[
                    const SizedBox(height: 8),
                    Text(_connectionMessage!),
                  ],
                  TextButton(
                    onPressed: _connecting
                        ? null
                        : () async {
                            await ref
                                .read(agentConnectionProvider.notifier)
                                .reset();
                            if (mounted) {
                              setState(() {
                                _gateway.text = kAgentBaseUrl;
                                _token.clear();
                                _connectionMessage = null;
                              });
                            }
                          },
                    child: const Text('Use build settings'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _DiagnosticCard(
            title: 'Environment',
            rows: {
              'Build': kDebugMode ? 'Debug' : 'Release',
              'Agent runtime': connection.restoring
                  ? 'Restoring'
                  : connection.configured
                  ? 'Configured'
                  : 'Disabled',
              'Gateway': connection.baseUrl.isEmpty
                  ? 'Not set'
                  : connection.baseUrl,
              'Connection token': connection.token == null
                  ? 'Build/session'
                  : 'Securely saved',
              'Auth token': token == null
                  ? 'None'
                  : (isDevAccessToken(token) ? 'Alpha/dev' : 'User'),
            },
          ),
          const SizedBox(height: 12),
          _DiagnosticCard(
            title: 'Runtime',
            rows: {
              'Health': _health,
              'Readiness': _readiness,
              'Configured agents': '${directory.agents.length}',
              'Directory': directory.loading
                  ? 'Loading'
                  : (directory.error ?? 'Loaded'),
              'Local conversations': '${chats.chatList.length}',
              'Last AgentRun': lastRun ?? 'None yet',
            },
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _checking ? null : _checkRuntime,
            icon: _checking
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.monitor_heart_outlined),
            label: Text(_checking ? 'Checking…' : 'Check runtime'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () =>
                ref.read(agentDirectoryProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh agents'),
          ),
          const SizedBox(height: 18),
          _DiagnosticCard(
            title: 'Scenario Lab',
            rows: {
              'Target': scenarioAgent?.displayName ?? 'No configured agent',
              'Mode': 'Visual test only · no backend side effect',
            },
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: scenarioAgent == null
                    ? null
                    : () {
                        ref
                            .read(aiChatProvider.notifier)
                            .injectScenario(
                              scenarioAgent.characterId,
                              part: const AgentMessagePart(
                                kind: AgentMessagePartKind.work,
                                title: 'Research prospects',
                                body:
                                    'Visual test of long-running work progress.',
                                status: 'working',
                                progressCurrent: 31,
                                progressTotal: 50,
                                referenceId: 'scenario-work',
                              ),
                            );
                        context.push('/chat/${scenarioAgent.characterId}');
                      },
                child: const Text('Work card'),
              ),
              OutlinedButton(
                onPressed: scenarioAgent == null
                    ? null
                    : () {
                        ref
                            .read(aiChatProvider.notifier)
                            .injectScenario(
                              scenarioAgent.characterId,
                              part: const AgentMessagePart(
                                kind: AgentMessagePartKind.artifact,
                                title: 'Alpha Research Report',
                                body:
                                    'Visual test of an agent-produced artifact.',
                                status: 'completed',
                                file: AgentFileRef(
                                  fileId: 'scenario-file',
                                  name: 'Alpha-Research-Report.pdf',
                                  mimeType: 'application/pdf',
                                  sizeBytes: 284000,
                                ),
                              ),
                            );
                        context.push('/chat/${scenarioAgent.characterId}');
                      },
                child: const Text('File result'),
              ),
              OutlinedButton(
                onPressed: scenarioAgent == null
                    ? null
                    : () {
                        ref
                            .read(aiChatProvider.notifier)
                            .injectScenario(
                              scenarioAgent.characterId,
                              part: const AgentMessagePart(
                                kind: AgentMessagePartKind.approval,
                                title: 'Approval needed',
                                body:
                                    'Visual test of a consequential action approval.',
                                status: 'pending',
                                referenceId: 'scenario-approval',
                                actionLabel: 'Approve / Change',
                              ),
                            );
                        context.push('/chat/${scenarioAgent.characterId}');
                      },
                child: const Text('Approval'),
              ),
              OutlinedButton(
                onPressed: scenarioAgent == null
                    ? null
                    : () {
                        ref
                            .read(aiChatProvider.notifier)
                            .injectScenario(
                              scenarioAgent.characterId,
                              part: const AgentMessagePart(
                                kind: AgentMessagePartKind.callResult,
                                title: 'Call completed',
                                body:
                                    'Visual test only. No phone call was placed.',
                                status: 'completed',
                                durationMs: 102000,
                                referenceId: 'scenario-call',
                              ),
                            );
                        context.push('/chat/${scenarioAgent.characterId}');
                      },
                child: const Text('Call result'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DiagnosticCard extends StatelessWidget {
  const _DiagnosticCard({required this.title, required this.rows});

  final String title;
  final Map<String, String> rows;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Card(
      color: u.surfaceCard,
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                color: u.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 10),
            for (final entry in rows.entries)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 120,
                      child: Text(
                        entry.key,
                        style: TextStyle(color: u.textMuted, fontSize: 12),
                      ),
                    ),
                    Expanded(
                      child: SelectableText(
                        entry.value,
                        style: TextStyle(color: u.textPrimary, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
