import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'human_chat_contract.dart';

/// Small per-account encrypted device draft cache; never a substitute for
/// C05's indexed message cache, durable outbox or server history.
/// Single account record avoids a multi-key index/write crash window.
class SecureHumanChatDraftStore implements HumanChatDraftStore {
  SecureHumanChatDraftStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;
  static const _prefix = 'masanawa.human_dm_drafts.v1.';
  static const _maxThreads = 16;
  // Serialize account read/modify/write and purge across all store instances
  // in this Flutter isolate to avoid clobbering parallel thread drafts.
  static final Map<String, Future<void>> _operations = {};

  Future<T> _withAccountLock<T>(String key, Future<T> Function() action) {
    final previous = _operations[key] ?? Future<void>.value();
    final gate = Completer<void>();
    _operations[key] = gate.future;
    return () async {
      await previous;
      try {
        return await action();
      } finally {
        gate.complete();
        if (identical(_operations[key], gate.future)) {
          _operations.remove(key);
        }
      }
    }();
  }

  String _key(String tenantId, String userId) {
    if (tenantId.trim().isEmpty || userId.trim().isEmpty) {
      throw ArgumentError('A verified account is required');
    }
    final account = jsonEncode([tenantId, userId]);
    return '$_prefix${base64Url.encode(utf8.encode(account))}';
  }

  Future<Map<String, dynamic>> _readAccount(String key) async {
    final raw = await _storage.read(key: key);
    if (raw == null) return <String, dynamic>{};
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic> || decoded['v'] != 1 ||
        decoded['threads'] is! Map<String, dynamic>) {
      throw const FormatException('Unsupported secure draft format');
    }
    return Map<String, dynamic>.from(decoded['threads'] as Map);
  }

  @override
  Future<HumanChatDraft?> read(HumanChatScope scope) async {
    if (!scope.valid) throw ArgumentError('Invalid conversation scope');
    final key = _key(scope.tenantId, scope.userId);
    return _withAccountLock(key, () async {
      final threads = await _readAccount(key);
      final data = threads[scope.conversationId];
      if (data == null) return null;
      if (data is! Map<String, dynamic>) {
        throw const FormatException('Invalid saved conversation draft');
      }
      return HumanChatDraft.fromJson(data);
    });
  }

  @override
  Future<void> write(HumanChatScope scope, HumanChatDraft value) async {
    if (!scope.valid) throw ArgumentError('Invalid conversation scope');
    if (value.text.length > 4000 ||
        (value.pendingText?.length ?? 0) > 4000) {
      throw ArgumentError('Oversized draft');
    }
    final key = _key(scope.tenantId, scope.userId);
    await _withAccountLock(key, () async {
      final threads = await _readAccount(key);
      threads.remove(scope.conversationId);
      threads[scope.conversationId] = value.toJson();
      // Retain newest entries and a hard storage bound on low-RAM devices.
      while (threads.length > _maxThreads) {
        threads.remove(threads.keys.first);
      }
      await _storage.write(
        key: key,
        value: jsonEncode({'v': 1, 'threads': threads}),
      );
    });
  }

  @override
  Future<void> remove(HumanChatScope scope) async {
    final key = _key(scope.tenantId, scope.userId);
    await _withAccountLock(key, () async {
      final threads = await _readAccount(key);
      threads.remove(scope.conversationId);
      if (threads.isEmpty) {
        await _storage.delete(key: key);
      } else {
        await _storage.write(key: key, value: jsonEncode({
          'v': 1,
          'threads': threads,
        }));
      }
    });
  }

  @override
  Future<void> clearAccount(String tenantId, String userId) {
    final key = _key(tenantId, userId);
    return _withAccountLock(key, () => _storage.delete(key: key));
  }
}
