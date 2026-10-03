import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../agents/masanawa_transport.dart';
import '../../core/providers.dart';
import '../../state/agent_directory_state.dart';
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

  Future<void> _checkRuntime() async {
    if (!isAgentRuntimeConfigured) {
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
        '$kAgentBaseUrl/healthz',
      );
      final ready = await dio.get<Map<String, dynamic>>(
        '$kAgentBaseUrl/readyz',
        options: Options(validateStatus: (_) => true),
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
    final u = context.masanawa;
    final directory = ref.watch(agentDirectoryProvider);
    final chats = ref.watch(aiChatProvider);
    final session = ref.watch(sessionProvider);
    final token = session is SessionSignedIn ? session.tokens.accessToken : null;
    final lastRun = chats.chatList
        .map((thread) => thread.agentRunId)
        .whereType<String>()
        .cast<String?>()
        .firstOrNull;

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
          _DiagnosticCard(
            title: 'Environment',
            rows: {
              'Build': kDebugMode ? 'Debug' : 'Release',
              'Agent runtime':
                  isAgentRuntimeConfigured ? 'Configured' : 'Disabled',
              'Gateway': kAgentBaseUrl.isEmpty ? 'Not set' : kAgentBaseUrl,
              'Auth token':
                  token == null ? 'None' : (isDevAccessToken(token) ? 'Alpha/dev' : 'User'),
            },
          ),
          const SizedBox(height: 12),
          _DiagnosticCard(
            title: 'Runtime',
            rows: {
              'Health': _health,
              'Readiness': _readiness,
              'Configured agents': '${directory.agents.length}',
              'Directory':
                  directory.loading ? 'Loading' : (directory.error ?? 'Loaded'),
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
