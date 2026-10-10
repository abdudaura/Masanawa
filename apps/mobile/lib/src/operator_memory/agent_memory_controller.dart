import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

@immutable
class AgentMemoryConsent {
  const AgentMemoryConsent({required this.enabled, required this.revision});
  final bool enabled;
  final int revision;

  factory AgentMemoryConsent.fromJson(Object? raw) {
    if (raw is! Map || raw['enabled'] is! bool ||
        raw['revision'] is! int || (raw['revision'] as int) < 0) {
      throw const FormatException('Invalid memory consent');
    }
    return AgentMemoryConsent(
      enabled: raw['enabled'] as bool,
      revision: raw['revision'] as int,
    );
  }
}

@immutable
class AgentMemoryEntry {
  const AgentMemoryEntry({
    required this.id, required this.kind, required this.content,
    required this.revision, required this.observedAt, this.expiresAt,
  });
  final String id;
  final String kind;
  final String content;
  final int revision;
  final DateTime observedAt;
  final DateTime? expiresAt;

  factory AgentMemoryEntry.fromJson(Object? raw) {
    if (raw is! Map || raw['id'] is! String ||
        !(raw['id'] as String).startsWith('memory-record_') ||
        raw['content'] is! String || raw['revision'] is! int ||
        (raw['revision'] as int) < 1 ||
        raw['observedAt'] is! String || raw['kind'] is! String ||
        !const {'preference', 'task-checkpoint', 'research-note'}
            .contains(raw['kind'])) {
      throw const FormatException('Invalid private memory entry');
    }
    final observedAt = DateTime.tryParse(raw['observedAt'] as String);
    final expiry = raw['expiresAt'] == null
        ? null : DateTime.tryParse(raw['expiresAt'] as String? ?? '');
    if (observedAt == null || (raw['expiresAt'] != null && expiry == null)) {
      throw const FormatException('Invalid memory timestamp');
    }
    return AgentMemoryEntry(
      id: raw['id'] as String, kind: raw['kind'] as String,
      content: raw['content'] as String, revision: raw['revision'] as int,
      observedAt: observedAt, expiresAt: expiry,
    );
  }
}

abstract class AgentMemoryTransport {
  Future<AgentMemoryConsent> consent();
  Future<AgentMemoryConsent> setConsent(bool enabled, int expectedRevision);
  Future<List<AgentMemoryEntry>> list();
  Future<AgentMemoryEntry> remember(String kind, String content, int ttlDays);
  Future<AgentMemoryEntry> correct(AgentMemoryEntry entry, String content);
  Future<String> prepareForget(AgentMemoryEntry entry);
}

/// Uses the existing authenticated Dio and current access token, never a token
/// entry field, client-selected tenant/relationship or plaintext local cache.
class DioAgentMemoryTransport implements AgentMemoryTransport {
  DioAgentMemoryTransport(this.dio, this.currentAccessToken);
  final Dio dio;
  final String? Function() currentAccessToken;

  Options get _options {
    final token = currentAccessToken();
    if (token == null || token.trim().isEmpty) {
      throw StateError('Sign in to manage private memory');
    }
    return Options(headers: {
      'Authorization': 'Bearer $token',
      'Cache-Control': 'no-store',
    });
  }

  @override
  Future<AgentMemoryConsent> consent() async {
    final result = await dio.get<Object?>('/operator/memory/consent',
        options: _options);
    return AgentMemoryConsent.fromJson(result.data);
  }

  @override
  Future<AgentMemoryConsent> setConsent(
      bool enabled, int expectedRevision) async {
    final result = await dio.put<Object?>('/operator/memory/consent',
        data: {'enabled': enabled, 'expectedRevision': expectedRevision},
        options: _options);
    return AgentMemoryConsent.fromJson(result.data);
  }

  @override
  Future<List<AgentMemoryEntry>> list() async {
    final result = await dio.get<Object?>('/operator/memory', options: _options);
    final raw = result.data;
    if (raw is! Map || raw['memories'] is! List) {
      throw const FormatException('Invalid memory list');
    }
    return List.unmodifiable((raw['memories'] as List)
        .map(AgentMemoryEntry.fromJson));
  }

  @override
  Future<AgentMemoryEntry> remember(
      String kind, String content, int ttlDays) async {
    final result = await dio.post<Object?>('/operator/memory',
        data: {'kind': kind, 'content': content, 'ttlDays': ttlDays},
        options: _options);
    return AgentMemoryEntry.fromJson(result.data);
  }

  @override
  Future<AgentMemoryEntry> correct(
      AgentMemoryEntry entry, String content) async {
    final result = await dio.patch<Object?>(
        '/operator/memory/' + Uri.encodeComponent(entry.id),
        data: {'expectedRevision': entry.revision, 'content': content},
        options: _options);
    return AgentMemoryEntry.fromJson(result.data);
  }

  @override
  Future<String> prepareForget(AgentMemoryEntry entry) async {
    final result = await dio.post<Object?>(
        '/operator/memory/' + Uri.encodeComponent(entry.id) + '/forget/prepare',
        data: {'expectedRevision': entry.revision},
        options: _options);
    final raw = result.data;
    if (raw is! Map || raw['approvalRequired'] != true ||
        raw['operationId'] is! String ||
        !(raw['operationId'] as String).startsWith('operation_')) {
      throw const FormatException('Missing governed deletion approval');
    }
    return raw['operationId'] as String;
  }
}

/// No memory survives sign-out/account switching in this controller. Do not
/// persist to preferences, logs or a global async cache.
class AgentMemoryController extends ChangeNotifier {
  AgentMemoryController({required this.transport, required this.sessionKey});
  final AgentMemoryTransport transport;
  final String? Function() sessionKey;
  String? _boundKey;
  int _epoch = 0;
  AgentMemoryConsent? consentState;
  List<AgentMemoryEntry> entries = const [];
  String? error;
  bool busy = false;
  bool get enabled => consentState?.enabled ?? false;

  void resetForAccountChange() {
    _epoch++;
    _boundKey = null;
    consentState = null;
    entries = const [];
    error = null;
    busy = false;
    notifyListeners();
  }

  int _start() {
    final key = sessionKey();
    if (key == null || key.isEmpty) {
      resetForAccountChange();
      throw StateError('Sign in required');
    }
    if (_boundKey != key) {
      resetForAccountChange();
      _boundKey = key;
    }
    if (busy) throw StateError('Memory action already in progress');
    busy = true;
    error = null;
    notifyListeners();
    return _epoch;
  }

  bool _current(int epoch) =>
      epoch == _epoch && _boundKey != null && sessionKey() == _boundKey;

  Future<T?> _run<T>(Future<T> Function() action,
      void Function(T) apply) async {
    int epoch;
    try {
      epoch = _start();
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return null;
    }
    try {
      final result = await action();
      if (_current(epoch)) {
        apply(result);
        notifyListeners();
        return result;
      }
      return null;
    } catch (e) {
      if (_current(epoch)) {
        error = e.toString();
        notifyListeners();
      }
      return null;
    } finally {
      if (_current(epoch)) {
        busy = false;
        notifyListeners();
      } else if (sessionKey() != _boundKey) {
        resetForAccountChange();
      }
    }
  }

  Future<void> refresh() async {
    await _run(() async {
      final consent = await transport.consent();
      final items = await transport.list();
      return (consent, items);
    }, (result) {
      consentState = result.$1;
      entries = result.$2;
    });
  }

  Future<void> optIn(bool value) async {
    final known = consentState;
    if (known == null) {
      error = 'Refresh consent first';
      notifyListeners();
      return;
    }
    await _run(() => transport.setConsent(value, known.revision),
        (result) { consentState = result; });
  }

  Future<void> remember(String kind, String content, {int ttlDays = 90}) async {
    if (!enabled) return;
    await _run(() => transport.remember(kind, content, ttlDays),
        (result) { entries = List.unmodifiable([result, ...entries]); });
  }

  Future<void> correct(AgentMemoryEntry entry, String content) async {
    await _run(() => transport.correct(entry, content), (result) {
      entries = List.unmodifiable([
        for (final item in entries) item.id == result.id ? result : item,
      ]);
    });
  }

  /// Prepares an operation, not a deletion receipt. Exact trusted approval
  /// remains mandatory before calling the canonical tombstone executor.
  Future<String?> prepareForget(AgentMemoryEntry entry) async =>
      _run(() => transport.prepareForget(entry), (_) {});
}
