import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../calls/call_history.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

class CallsScreen extends ConsumerWidget {
  const CallsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Calls'),
        actions: [
          IconButton(
            tooltip: 'Choose a Masana',
            icon: const Icon(Icons.add_call),
            onPressed: session is SessionSignedIn
                ? () => context.push('/masana')
                : null,
          ),
        ],
      ),
      body: session is SessionSignedIn
          ? _CallHistoryList(
              key: ObjectKey(session.tokens),
              accountId: session.user.id,
              sessionIdentity: session.tokens,
            )
          : session is SessionRestoring
          ? const Center(child: CircularProgressIndicator())
          : const Center(child: Text('Sign in to see your calls.')),
    );
  }
}

class _CallHistoryList extends ConsumerStatefulWidget {
  const _CallHistoryList({
    super.key,
    required this.accountId,
    required this.sessionIdentity,
  });
  final String accountId;
  final Object sessionIdentity;
  @override
  ConsumerState<_CallHistoryList> createState() => _CallHistoryListState();
}

class _CallHistoryListState extends ConsumerState<_CallHistoryList> {
  List<CallHistoryItem> _calls = [];
  String? _nextCursor;
  bool _loading = true;
  bool _failed = false;
  bool _retryRefresh = true;
  int _generation = 0;
  CancelToken? _request;
  @override
  void initState() {
    super.initState();
    _load(refresh: true);
  }

  @override
  void dispose() {
    _generation++;
    _request?.cancel();
    super.dispose();
  }

  bool get _sameAccount {
    final session = ref.read(sessionProvider);
    return session is SessionSignedIn &&
        session.user.id == widget.accountId &&
        identical(session.tokens, widget.sessionIdentity);
  }

  Future<void> _load({bool refresh = false}) async {
    if (!refresh && _loading) return;
    if (refresh) {
      _generation++;
      _request?.cancel();
    }
    final generation = _generation;
    final token = CancelToken();
    _request = token;
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final page = await ref
          .read(callHistoryTransportProvider)
          .loadPage(cursor: refresh ? null : _nextCursor, cancelToken: token);
      if (!mounted || generation != _generation || !_sameAccount) return;
      setState(() {
        final combined = [if (!refresh) ..._calls, ...page.calls];
        final ids = <String>{};
        _calls = combined.where((call) => ids.add(call.callId)).toList();
        _nextCursor = page.nextCursor;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || generation != _generation || !_sameAccount) return;
      setState(() {
        _loading = false;
        _failed = true;
        _retryRefresh = refresh;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return RefreshIndicator(
      onRefresh: () => _load(refresh: true),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (_loading) const LinearProgressIndicator(),
          if (!_loading && !_failed && _calls.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.call_outlined, size: 58, color: u.brand),
                  const SizedBox(height: 18),
                  const Text(
                    'No recent calls',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your calls with Masana will appear here.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          for (final call in _calls)
            ListTile(
              leading: Icon(Icons.call_made, color: u.brand),
              title: Text(call.displayName),
              subtitle: Text(
                '${_label(call.state)} · ${_date(context, call.createdAt)}',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(
                '/chat/${Uri.encodeComponent(call.characterId)}',
              ),
            ),
          if (_failed)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Text(
                    'Could not load calls. Check your connection and try again.',
                    textAlign: TextAlign.center,
                  ),
                  TextButton(
                    onPressed: () => _load(refresh: _retryRefresh),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          if (!_loading && !_failed && _nextCursor != null)
            TextButton(onPressed: _load, child: const Text('Load more')),
        ],
      ),
    );
  }

  String _label(String state) => switch (state) {
    'connecting' => 'Connecting',
    'active' => 'Connected',
    'ended' => 'Ended',
    _ => 'Expired',
  };
  String _date(BuildContext context, DateTime timestamp) {
    final local = timestamp.toLocal();
    final strings = MaterialLocalizations.of(context);
    return '${strings.formatMediumDate(local)} ${strings.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
  }
}
