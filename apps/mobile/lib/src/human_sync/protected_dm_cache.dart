import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart' as hashes;
import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as path;
import 'package:sqflite/sqflite.dart';

/// Local cache, NEVER a source of message membership, delivery or payment authority.
/// Message body, contact details, preview and outbox payloads are all AES-256-GCM
/// encrypted, with row-scoped authenticated associated data. Only opaque IDs,
/// sequence numbers and timestamps remain in SQLite for indexed retrieval.
class ProtectedDmCache {
  ProtectedDmCache._(this._db, this._key, this.ownerId, this.tenantId);

  final Database _db;
  final SecretKey _key;
  final String ownerId;
  final String tenantId;
  bool _closed = false;

  static const FlutterSecureStorage _keys = FlutterSecureStorage();
  static const int maxCachedMessages = 120000;
  static const int maxCachedThreads = 1200;
  static const int maxQueued = 500;
  static final AesGcm _aead = AesGcm.with256bits();
  static final Map<String, Future<void>> _keyLocks = {};

  /// Serializes key creation and deletion within the UI isolate/process.
  /// A separate background isolate must coordinate through the same owner.
  static Future<T> _keyExclusive<T>(String namespace,
      Future<T> Function() action) async {
    final previous = _keyLocks[namespace];
    final done = Completer<void>();
    final ticket = done.future;
    _keyLocks[namespace] = ticket;
    if (previous != null) await previous;
    try {
      return await action();
    } finally {
      done.complete();
      if (identical(_keyLocks[namespace], ticket)) _keyLocks.remove(namespace);
    }
  }

  static String _digest(String value) =>
      hashes.sha256.convert(utf8.encode(value)).toString();

  static String _namespace(String tenantId, String ownerId) {
    if (tenantId.trim().isEmpty || ownerId.trim().isEmpty ||
        tenantId.length > 256 || ownerId.length > 256) {
      throw ArgumentError('Verified tenant and account IDs are required');
    }
    return _digest('dm-cache-v1|' + tenantId + '|' + ownerId);
  }

  /// Opens only after a signed-in account has been verified by sessionProvider.
  /// Both SQLite database and keystore secret are individually per account.
  /// A missing key for an existing file FAILS CLOSED; ciphertext is not replaced.
  static Future<ProtectedDmCache> openForAccount({
    required String tenantId,
    required String ownerId,
  }) async {
    final ns = _namespace(tenantId, ownerId);
    return _keyExclusive(ns, () async {
    final databasePath = path.join(await getDatabasesPath(), 'masanawa-dm-' + ns + '.db');
    final secretName = 'masanawa.dm.cache.aes.v1.' + ns;
    final existing = await _keys.read(key: secretName);
    if (existing == null && await File(databasePath).exists()) {
      throw StateError('Private cache encryption key unavailable; clear cache to recover');
    }
    final secureRandom = Random.secure();
    final keyBytes = existing == null
        ? List<int>.generate(32, (_) => secureRandom.nextInt(256))
        : base64Decode(existing);
    if (keyBytes.length != 32) {
      throw const FormatException('Invalid private cache encryption key');
    }
    if (existing == null) {
      await _keys.write(key: secretName, value: base64Encode(keyBytes));
      // A second isolate/device session must not silently replace the key.
      if (await _keys.read(key: secretName) != base64Encode(keyBytes)) {
        throw StateError('Private cache key changed during initialization');
      }
    }
    try {
      final db = await openDatabase(databasePath, version: 1,
          onCreate: (db, version) => createSchema(db));
      return ProtectedDmCache._(db, SecretKey(keyBytes), ownerId, tenantId);
    } catch (_) {
      // Never delete a key if a concurrent opener could own this database.
      rethrow;
    }
    });
  }

  /// Enables real-SQLite/real-crypto regression tests without a fake data store.
  /// Never use this to supply a hardcoded production encryption key.
  static Future<ProtectedDmCache> attachForTest({
    required Database database,
    required List<int> keyBytes,
    required String tenantId,
    required String ownerId,
  }) async {
    _namespace(tenantId, ownerId);
    if (keyBytes.length != 32) throw ArgumentError('AES-256 key required');
    await createSchema(database);
    return ProtectedDmCache._(database, SecretKey(keyBytes), ownerId, tenantId);
  }

  static Future<void> createSchema(DatabaseExecutor db) async {
    await db.execute('PRAGMA foreign_keys = ON');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS dm_inbox (
        conversation_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE INDEX IF NOT EXISTS dm_inbox_updated
      ON dm_inbox(updated_at_ms DESC, conversation_key)
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS dm_messages (
        conversation_key TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK(sequence > 0),
        payload TEXT NOT NULL,
        PRIMARY KEY(conversation_key, sequence)
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS dm_outbox (
        request_id TEXT PRIMARY KEY,
        conversation_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued', 'uncertain', 'rejected'))
      )
    ''');
    await db.execute('''
      CREATE INDEX IF NOT EXISTS dm_outbox_order
      ON dm_outbox(created_at_ms, request_id)
    ''');
  }

  void _ensureOpen() {
    if (_closed || !_db.isOpen) throw StateError('Private cache is closed');
  }

  String _thread(String conversationId) {
    if (conversationId.isEmpty || conversationId.length > 128) {
      throw ArgumentError('Invalid conversation ID');
    }
    return _digest('thread|' + tenantId + '|' + ownerId + '|' + conversationId);
  }

  Future<String> _seal(String aad, Map<String, dynamic> content) async {
    final box = await _aead.encrypt(
      utf8.encode(jsonEncode(content)), secretKey: _key,
      aad: utf8.encode(aad),
    );
    return base64Encode(box.concatenation());
  }

  Future<Map<String, dynamic>> _unseal(String aad, String data) async {
    final box = SecretBox.fromConcatenation(base64Decode(data),
        nonceLength: 12, macLength: 16);
    final bytes = await _aead.decrypt(box, secretKey: _key, aad: utf8.encode(aad));
    final decoded = jsonDecode(utf8.decode(bytes));
    if (decoded is! Map<String, dynamic>) throw const FormatException('Invalid cached record');
    return decoded;
  }

  /// Exactly one verified server inbox snapshot; no speculative client contacts.
  /// Last-write-wins for a fresh response. Cache is not membership proof.
  Future<void> putInbox(List<Map<String, dynamic>> conversations) async {
    _ensureOpen();
    final rows = <Map<String, Object?>>[];
    for (final conversation in conversations) {
      final id = conversation['conversationId'];
      final updated = conversation['updatedAt'];
      if (id is! String || updated is! String) {
        throw const FormatException('Invalid inbox data');
      }
      final thread = _thread(id);
      rows.add({
        'conversation_key': thread,
        'payload': await _seal('inbox|' + thread, conversation),
        'updated_at_ms': DateTime.parse(updated).toUtc().millisecondsSinceEpoch,
      });
    }
    await _db.transaction((txn) async {
      final batch = txn.batch();
      for (final row in rows) {
        batch.insert('dm_inbox', row, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await batch.commit(noResult: true);
      await txn.rawDelete('''
        DELETE FROM dm_inbox WHERE conversation_key NOT IN
        (SELECT conversation_key FROM dm_inbox
         ORDER BY updated_at_ms DESC LIMIT ?)
      ''', [maxCachedThreads]);
    });
  }

  Future<List<Map<String, dynamic>>> inbox({int limit = 40}) async {
    _ensureOpen();
    if (limit < 1 || limit > 100) throw ArgumentError('Invalid page size');
    final rows = await _db.query('dm_inbox',
        orderBy: 'updated_at_ms DESC, conversation_key', limit: limit);
    final result = <Map<String, dynamic>>[];
    for (final row in rows) {
      final key = row['conversation_key'] as String;
      result.add(await _unseal('inbox|' + key, row['payload'] as String));
    }
    return result;
  }

  /// Idempotent sequence upsert; edited/deleted server tombstones replace stale
  /// local bodies. Encrypt before transaction to keep write locks short.
  Future<void> putMessages(String conversationId, List<Map<String, dynamic>> messages) async {
    _ensureOpen();
    final thread = _thread(conversationId);
    final rows = <Map<String, Object?>>[];
    for (final message in messages) {
      if (message['conversationId'] != conversationId ||
          message['messageId'] is! String ||
          message['sequence'] is! String) {
        throw const FormatException('Message does not belong to conversation');
      }
      final seq = int.parse(message['sequence'] as String);
      if (seq <= 0) throw const FormatException('Invalid server sequence');
      rows.add({
        'conversation_key': thread,
        'sequence': seq,
        'payload': await _seal('message|' + thread + '|' + seq.toString(), message),
      });
    }
    await _db.transaction((txn) async {
      final batch = txn.batch();
      for (final row in rows) {
        batch.insert('dm_messages', row, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await batch.commit(noResult: true);
      // Bounded disk use; all missing rows remain recoverable from the server.
      await txn.rawDelete('''
        DELETE FROM dm_messages WHERE rowid IN (
          SELECT rowid FROM dm_messages
          ORDER BY rowid DESC LIMIT -1 OFFSET ?
        )
      ''', [maxCachedMessages]);
    });
  }

  /// Uses SQLite keyset indexing rather than loading/decrypting entire history.
  Future<List<Map<String, dynamic>>> messages(String conversationId,
      {int limit = 40, String? before}) async {
    _ensureOpen();
    if (limit < 1 || limit > 50) throw ArgumentError('Invalid page size');
    final thread = _thread(conversationId);
    final rows = await _db.query('dm_messages',
      where: before == null
          ? 'conversation_key = ?'
          : 'conversation_key = ? AND sequence < ?',
      whereArgs: before == null ? [thread] : [thread, int.parse(before)],
      orderBy: 'sequence DESC', limit: limit);
    final result = <Map<String, dynamic>>[];
    for (final row in rows) {
      final seq = row['sequence'] as int;
      result.add(await _unseal(
          'message|' + thread + '|' + seq.toString(), row['payload'] as String));
    }
    return result;
  }

  /// Persist BEFORE first network attempt. Same ID must survive app termination.
  /// Neither queued nor uncertain means sent, accepted, or delivered.
  Future<void> queue({
    required String conversationId,
    required String requestId,
    required String text,
  }) async {
    _ensureOpen();
    final content = text.trim();
    if (content.isEmpty || content.runes.length > 4000 ||
        utf8.encode(content).length > 16000 ||
        !RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{11,127}$').hasMatch(requestId)) {
      throw ArgumentError('Invalid outgoing text or request ID');
    }
    final thread = _thread(conversationId);
    final previous = await _db.query('dm_outbox',
        where: 'request_id = ?', whereArgs: [requestId], limit: 1);
    if (previous.isNotEmpty) {
      final old = await _unseal('outbox|' + requestId,
          previous.single['payload'] as String);
      if (old['conversationId'] != conversationId || old['text'] != content) {
        throw StateError('Reusing a request ID for another message is forbidden');
      }
      return;
    }
    final count = Sqflite.firstIntValue(
        await _db.rawQuery('SELECT COUNT(*) FROM dm_outbox')) ?? 0;
    if (count >= maxQueued) throw StateError('Outbox is full; retry existing messages');
    final cipher = await _seal('outbox|' + requestId,
        {'conversationId': conversationId, 'text': content});
    await _db.insert('dm_outbox', {
      'request_id': requestId,
      'conversation_key': thread,
      'payload': cipher,
      'created_at_ms': DateTime.now().toUtc().millisecondsSinceEpoch,
      'state': 'queued',
    }, conflictAlgorithm: ConflictAlgorithm.abort);
  }

  Future<List<DmQueuedMessage>> pending({int limit = 50}) async {
    _ensureOpen();
    if (limit < 1 || limit > 100) throw ArgumentError('Invalid outbox page');
    final rows = await _db.query('dm_outbox', orderBy: 'created_at_ms, request_id',
        limit: limit);
    final result = <DmQueuedMessage>[];
    for (final row in rows) {
      final id = row['request_id'] as String;
      final content = await _unseal('outbox|' + id, row['payload'] as String);
      result.add(DmQueuedMessage(
        conversationId: content['conversationId'] as String,
        requestId: id,
        text: content['text'] as String,
        state: row['state'] as String,
      ));
    }
    return result;
  }

  Future<void> mark(String requestId, String state) async {
    _ensureOpen();
    if (!{'queued', 'uncertain', 'rejected'}.contains(state)) {
      throw ArgumentError('Invalid send state');
    }
    await _db.update('dm_outbox', {'state': state},
        where: 'request_id = ?', whereArgs: [requestId]);
  }

  /// Only a verified authoritative C02 server ack removes a queued request.
  Future<void> acknowledge(String requestId,
      Map<String, dynamic> serverMessage) async {
    _ensureOpen();
    final rows = await _db.query('dm_outbox',
        where: 'request_id = ?', whereArgs: [requestId], limit: 1);
    if (rows.isEmpty) return;
    final queued = await _unseal('outbox|' + requestId,
        rows.single['payload'] as String);
    if (serverMessage['clientRequestId'] != requestId ||
        serverMessage['conversationId'] != queued['conversationId'] ||
        serverMessage['senderUserId'] != ownerId) {
      throw const FormatException('Server acknowledgement principal/request mismatch');
    }
    await putMessages(queued['conversationId'] as String, [serverMessage]);
    await _db.delete('dm_outbox', where: 'request_id = ?', whereArgs: [requestId]);
  }


  /// Upon a verified 403/404 from the authority, erase stale thread content,
  /// drafts and inbox preview. Never use a cached thread to override a denial.
  Future<void> revokeConversation(String conversationId) async {
    _ensureOpen();
    final thread = _thread(conversationId);
    await _db.transaction((txn) async {
      await txn.delete('dm_messages',
          where: 'conversation_key = ?', whereArgs: [thread]);
      await txn.delete('dm_inbox',
          where: 'conversation_key = ?', whereArgs: [thread]);
      await txn.delete('dm_outbox',
          where: 'conversation_key = ?', whereArgs: [thread]);
    });
  }

  Future<void> discard(String requestId) async {
    _ensureOpen();
    await _db.delete('dm_outbox', where: 'request_id = ?', whereArgs: [requestId]);
  }

  /// Called immediately after logout, account deletion or explicit cache clear.
  /// Requires all sync dispatchers to have stopped before revoking this cache.
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    await _db.close();
  }

  /// Deletes ciphertext and its separate per-account key. Old ciphertext
  /// cannot be recovered after key deletion; server history stays authoritative.
  static Future<void> wipeAccount({
    required String tenantId,
    required String ownerId,
  }) async {
    final ns = _namespace(tenantId, ownerId);
    await _keyExclusive(ns, () async {
      await _keys.delete(key: 'masanawa.dm.cache.aes.v1.' + ns);
      await deleteDatabase(path.join(await getDatabasesPath(),
          'masanawa-dm-' + ns + '.db'));
    });
  }
}

class DmQueuedMessage {
  const DmQueuedMessage({
    required this.conversationId,
    required this.requestId,
    required this.text,
    required this.state,
  });
  final String conversationId;
  final String requestId;
  final String text;
  final String state;
}
