import 'dart:async';
import 'dart:convert';

import 'shell_action_coordinator.dart';
import 'shell_document.dart';

abstract class ShellEncryptedStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
  Future<Map<String, String>> readAll();
}

/// One UI-isolate owner of encrypted records. Static serialization covers
/// multiple widgets/instances using the same namespace. Do not share this store
/// with background isolates; server command idempotency remains mandatory.
class EncryptedShellActionJournal implements ShellActionJournal {
  EncryptedShellActionJournal({required this.store, required this.namespace}) {
    if (namespace.trim().isEmpty || namespace.length > 1024) {
      throw ArgumentError('User/session namespace required');
    }
    _epoch = _epochs[_storageKey] ?? 0;
  }
  final ShellEncryptedStore store;
  final String namespace;
  static final _locks = <String, Future<void>>{};
  static final _epochs = <String, int>{};
  late final int _epoch;
  bool _closed = false;
  String get _storageKey => 'masanawa.shell.actions.v1:$namespace';

  static String _ownerSegment(String ownerId) =>
      base64Url.encode(utf8.encode(ownerId)).replaceAll('=', '');

  static String namespaceForOwnerSession({
    required String ownerId,
    required String sessionId,
  }) {
    final cleanOwner = ownerId.trim();
    final cleanSession = sessionId.trim();
    if (cleanOwner.isEmpty ||
        cleanOwner.length > 512 ||
        cleanSession.isEmpty ||
        cleanSession.length > 512) {
      throw ArgumentError('Valid owner and session ids required');
    }
    return '${_ownerSegment(cleanOwner)}:$cleanSession';
  }

  static Future<void> clearOwner({
    required ShellEncryptedStore store,
    required String ownerId,
  }) async {
    final cleanOwner = ownerId.trim();
    if (cleanOwner.isEmpty || cleanOwner.length > 512) {
      throw ArgumentError('Valid owner id required');
    }
    final prefix =
        'masanawa.shell.actions.v1:${_ownerSegment(cleanOwner)}:';
    final legacyPrefix = cleanOwner.contains(':')
        ? null
        : 'masanawa.shell.actions.v1:$cleanOwner:';
    final all = await store.readAll();
    final keys = all.keys
        .where(
          (key) =>
              key.startsWith(prefix) ||
              (legacyPrefix != null && key.startsWith(legacyPrefix)),
        )
        .toList(growable: false);
    for (final key in keys) {
      final previous = _locks[key] ?? Future<void>.value();
      final gate = Completer<void>();
      final ticket = gate.future;
      _locks[key] = ticket;
      await previous;
      try {
        await store.delete(key);
        _epochs[key] = (_epochs[key] ?? 0) + 1;
      } finally {
        gate.complete();
        if (identical(_locks[key], ticket)) _locks.remove(key);
      }
    }
  }

  Future<T> _exclusive<T>(Future<T> Function() work) async {
    final previous = _locks[_storageKey] ?? Future<void>.value();
    final gate = Completer<void>();
    final ticket = gate.future;
    _locks[_storageKey] = ticket;
    await previous;
    try {
      if (_closed || _epoch != (_epochs[_storageKey] ?? 0)) {
        throw StateError('Action journal closed');
      }
      return await work();
    } finally {
      gate.complete();
      if (identical(_locks[_storageKey], ticket)) _locks.remove(_storageKey);
    }
  }

  Future<Map<String, dynamic>> _load() async {
    final raw = await store.read(_storageKey);
    if (raw == null) return {};
    if (raw.length > 512000)
      throw const FormatException('Action journal too large');
    final decoded = jsonDecode(raw);
    if (decoded is! Map ||
        decoded['version'] != 1 ||
        decoded['records'] is! Map) {
      throw const FormatException('Invalid action journal');
    }
    final records = Map<String, dynamic>.from(decoded['records'] as Map);
    if (records.length > 128)
      throw const FormatException('Action journal too large');
    for (final record in records.values) {
      _decode(record);
    }
    return records;
  }

  ShellActionRecord _decode(dynamic raw) {
    if (raw is! Map ||
        raw['revision'] is! int ||
        raw['revision'] < 0 ||
        raw['values'] is! Map ||
        !{'pending', 'completed'}.contains(raw['state'])) {
      throw const FormatException('Invalid action record');
    }
    String string(String field, int limit) {
      final value = raw[field];
      if (value is! String || value.isEmpty || value.length > limit) {
        throw const FormatException('Invalid action record');
      }
      return value;
    }

    final values = <String, String>{};
    final rawValues = raw['values'] as Map;
    if (rawValues.length > 100)
      throw const FormatException('Invalid action values');
    for (final entry in rawValues.entries) {
      if (entry.key is! String ||
          (entry.key as String).length > 128 ||
          entry.value is! String ||
          (entry.value as String).length > 512) {
        throw const FormatException('Invalid action values');
      }
      values[entry.key as String] = entry.value as String;
    }
    return ShellActionRecord(
      state: raw['state'] == 'completed'
          ? ShellActionState.completed
          : ShellActionState.pending,
      action: ShellAction(
        documentId: string('documentId', 128),
        revision: raw['revision'] as int,
        nodeId: string('nodeId', 128),
        actionId: string('actionId', 128),
        token: string('token', 2048),
        values: Map.unmodifiable(values),
      ),
    );
  }

  Map<String, dynamic> _encode(ShellAction action, String state) => {
    'documentId': action.documentId,
    'revision': action.revision,
    'nodeId': action.nodeId,
    'actionId': action.actionId,
    'token': action.token,
    'values': action.values,
    'state': state,
  };
  Future<void> _save(Map<String, dynamic> records) async {
    final encoded = jsonEncode({'version': 1, 'records': records});
    if (encoded.length > 512000) throw StateError('Action journal full');
    await store.write(_storageKey, encoded);
  }

  @override
  Future<ShellActionRecord?> read(String key) => _exclusive(() async {
    final records = await _load();
    return records[key] == null ? null : _decode(records[key]);
  });

  @override
  Future<bool> createPending(String key, ShellAction action) =>
      _exclusive(() async {
        final records = await _load();
        if (records.containsKey(key)) {
          _decode(records[key]);
          return false;
        }
        if (records.length >= 128) throw StateError('Action journal full');
        final encoded = _encode(action, 'pending');
        _decode(encoded);
        records[key] = encoded;
        await _save(records);
        return true;
      });

  @override
  Future<void> complete(String key) => _exclusive(() async {
    final records = await _load();
    final record = _decode(records[key]);
    if (record.state == ShellActionState.completed) return;
    records[key] = _encode(record.action, 'completed');
    await _save(records);
  });

  /// Invoke on account removal/logout after stopping its dispatchers.
  Future<void> clearAndClose() => _exclusive(() async {
    await store.delete(_storageKey);
    _epochs[_storageKey] = _epoch + 1;
    _closed = true;
  });
}
