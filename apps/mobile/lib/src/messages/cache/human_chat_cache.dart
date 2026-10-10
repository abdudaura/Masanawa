import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite_sqlcipher/sqflite.dart';

import 'human_chat_models.dart';

/// Testable seam. Production always opens SQLCipher with a nonempty password.
typedef HumanChatDbOpener = Future<Database> Function(
  String path,
  String password,
);

abstract interface class HumanChatSecrets {
  Future<String?> read(String key);
  Future<void> write(String key, String secret);
  Future<void> delete(String key);
}

class SecureHumanChatSecrets implements HumanChatSecrets {
  SecureHumanChatSecrets({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );
  final FlutterSecureStorage _storage;
  @override
  Future<String?> read(String key) => _storage.read(key: key);
  @override
  Future<void> write(String key, String secret) =>
      _storage.write(key: key, value: secret);
  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

Future<Database> _productionOpen(String path, String password) =>
    openDatabase(
      path,
      password: password,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
      onCreate: createHumanChatCacheSchema,
      onUpgrade: (_, oldVersion, newVersion) => throw StateError(
        'Chat cache schema migration $oldVersion->$newVersion not defined',
      ),
    );

Future<void> createHumanChatCacheSchema(Database db, int version) async {
  await db.execute('''
    CREATE TABLE threads (
      conversation_id TEXT PRIMARY KEY,
      peer_user_id TEXT NOT NULL,
      display_name TEXT,
      updated_at_ms INTEGER NOT NULL,
      last_sequence INTEGER NOT NULL DEFAULT 0 CHECK(last_sequence >= 0),
      preview TEXT,
      unread_count INTEGER NOT NULL DEFAULT 0 CHECK(unread_count >= 0)
    )''');
  await db.execute('''
    CREATE TABLE messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES threads(conversation_id) ON DELETE CASCADE,
      sender_user_id TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK(sequence > 0),
      client_request_id TEXT,
      body TEXT,
      created_at_ms INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
      UNIQUE(conversation_id, sequence),
      CHECK((deleted = 0 AND body IS NOT NULL) OR (deleted = 1 AND body IS NULL))
    )''');
  await db.execute(
    'CREATE INDEX messages_history_idx ON messages(conversation_id,sequence DESC)',
  );
  await db.execute(
    'CREATE INDEX threads_recent_idx ON threads(updated_at_ms DESC,conversation_id)',
  );
  await db.execute('''
    CREATE TABLE outbox (
      request_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES threads(conversation_id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 16000),
      created_at_ms INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
      retry_after_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','unknown','blocked'))
    )''');
  await db.execute(
    'CREATE INDEX outbox_retry_idx ON outbox(status,retry_after_ms,created_at_ms)',
  );
  await db.execute('''
    CREATE TABLE sync_cursors (
      conversation_id TEXT PRIMARY KEY REFERENCES threads(conversation_id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL DEFAULT 0 CHECK(sequence >= 0)
    )''');
}

/// Account-owned, indexed, encrypted *projection*. The remote Gateway is still
/// authoritative for membership, block policy, receipt and read status.
///
/// A lost key never silently resets an existing cache. On sign-out, the session
/// integration must call [purgeAccount] before revealing a different account.
class HumanChatCache {
  HumanChatCache({
    HumanChatSecrets? secrets,
    HumanChatDbOpener? dbOpener,
    Future<Directory> Function()? supportDirectory,
  })  : _secrets = secrets ?? SecureHumanChatSecrets(),
        _openDatabase = dbOpener ?? _productionOpen,
        _directory = supportDirectory ?? getApplicationSupportDirectory;

  final HumanChatSecrets _secrets;
  final HumanChatDbOpener _openDatabase;
  final Future<Directory> Function() _directory;
  Database? _database;
  String? _openScope;
  Future<void> _transition = Future<void>.value();

  String _scope(String tenantId, String userId) {
    if (tenantId.trim().isEmpty ||
        userId.trim().isEmpty ||
        tenantId.length > 256 ||
        userId.length > 256) {
      throw const FormatException('Verified tenant and user are required');
    }
    return sha256.convert(utf8.encode('$tenantId\u0000$userId')).toString();
  }

  String _secretKey(String scope) => 'human_dm_cipher_v1_$scope';
  String _fileName(String scope) => 'human_dm_v1_$scope.db';

  Future<T> _exclusive<T>(Future<T> Function() operation) async {
    final prior = _transition;
    final release = Completer<void>();
    _transition = release.future;
    await prior;
    try {
      return await operation();
    } finally {
      release.complete();
    }
  }

  String _newPassword() {
    final random = Random.secure();
    return base64UrlEncode(List<int>.generate(32, (_) => random.nextInt(256)));
  }

  Future<void> openAccount({
    required String tenantId,
    required String userId,
  }) => _exclusive(() async {
        final scope = _scope(tenantId, userId);
        if (_openScope == scope && _database != null) return;
        await _database?.close();
        _database = null;
        _openScope = null;
        final directory = await _directory();
        await directory.create(recursive: true);
        final file = File('${directory.path}/${_fileName(scope)}');
        final existing = await _secrets.read(_secretKey(scope));
        if (existing == null && await file.exists()) {
          throw StateError('Chat cache encryption key unavailable; purge explicitly');
        }
        final password = existing ?? _newPassword();
        if (existing == null) await _secrets.write(_secretKey(scope), password);
        // No catch-and-wipe: a wrong key/corrupt DB must never expose content,
        // silently discard offline drafts or switch to plaintext SQLite.
        _database = await _openDatabase(file.path, password);
        _openScope = scope;
      });

  Database _forAccount(String tenantId, String userId) {
    if (_openScope != _scope(tenantId, userId) || _database == null) {
      throw StateError('Human chat cache is not open for this signed-in account');
    }
    return _database!;
  }

  Future<void> close() => _exclusive(() async {
        await _database?.close();
        _database = null;
        _openScope = null;
      });

  /// Wipes the cache + secret for a signed-out/revoked account. Never called
  /// automatically on a temporary network error or database-open failure.
  Future<void> purgeAccount({
    required String tenantId,
    required String userId,
  }) => _exclusive(() async {
        final scope = _scope(tenantId, userId);
        if (_openScope == scope) {
          await _database?.close();
          _database = null;
          _openScope = null;
        }
        final directory = await _directory();
        final path = '${directory.path}/${_fileName(scope)}';
        await deleteDatabase(path);
        await _secrets.delete(_secretKey(scope));
      });

  /// Only a verified server revocation/deletion invokes this. Network
  /// failures never erase legitimate offline content. Cascades remove local
  /// messages, sync cursor and unacknowledged drafts for the same thread.
  Future<void> revokeConversation({
    required String tenantId,
    required String userId,
    required String conversationId,
  }) async {
    await _forAccount(tenantId, userId).delete(
      'threads',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
    );
  }

  Future<void> saveThread({
    required String tenantId,
    required String userId,
    required CachedHumanThread thread,
  }) async {
    if (thread.conversationId.isEmpty ||
        thread.peerUserId.isEmpty ||
        thread.lastSequence < 0 ||
        thread.unreadCount < 0) {
      throw const FormatException('Invalid server thread projection');
    }
    final db = _forAccount(tenantId, userId);
    await db.rawInsert('''
      INSERT INTO threads
        (conversation_id,peer_user_id,display_name,updated_at_ms,last_sequence,preview,unread_count)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        peer_user_id=excluded.peer_user_id,
        display_name=CASE WHEN excluded.updated_at_ms >= threads.updated_at_ms
          THEN excluded.display_name ELSE threads.display_name END,
        updated_at_ms=MAX(threads.updated_at_ms,excluded.updated_at_ms),
        last_sequence=MAX(threads.last_sequence,excluded.last_sequence),
        preview=CASE WHEN excluded.updated_at_ms >= threads.updated_at_ms
          THEN excluded.preview ELSE threads.preview END,
        unread_count=CASE WHEN excluded.updated_at_ms >= threads.updated_at_ms
          THEN excluded.unread_count ELSE threads.unread_count END
    ''', [
      thread.conversationId,
      thread.peerUserId,
      thread.displayName,
      thread.updatedAtMs,
      thread.lastSequence,
      thread.preview,
      thread.unreadCount,
    ]);
  }

  Future<List<CachedHumanThread>> recentThreads({
    required String tenantId,
    required String userId,
    int limit = 40,
  }) async {
    if (limit < 1 || limit > 50) throw RangeError.range(limit, 1, 50);
    final rows = await _forAccount(tenantId, userId).query(
      'threads',
      orderBy: 'updated_at_ms DESC,conversation_id',
      limit: limit,
    );
    return List.unmodifiable(rows.map(CachedHumanThread.fromRow));
  }

  Future<void> applyServerPage({
    required String tenantId,
    required String userId,
    required String conversationId,
    required List<CachedHumanMessage> messages,
    required int? nextSyncSequence,
  }) async {
    if (conversationId.isEmpty ||
        messages.length > 100 ||
        (nextSyncSequence != null && nextSyncSequence < 0)) {
      throw const FormatException('Invalid bounded server message page');
    }
    for (final item in messages) {
      if (item.conversationId != conversationId ||
          item.messageId.isEmpty ||
          item.senderUserId.isEmpty ||
          item.sequence <= 0 ||
          (!item.deleted && item.body == null) ||
          (item.body?.length ?? 0) > 16000) {
        throw const FormatException('Invalid server message projection');
      }
    }
    final db = _forAccount(tenantId, userId);
    await db.transaction((tx) async {
      final thread = await tx.query(
        'threads',
        columns: ['conversation_id'],
        where: 'conversation_id = ?',
        whereArgs: [conversationId],
        limit: 1,
      );
      if (thread.isEmpty) {
        throw StateError('Server conversation must be authorized before caching messages');
      }
      for (final item in messages) {
        final previous = await tx.query(
          'messages',
          columns: ['conversation_id', 'sequence', 'deleted'],
          where: 'message_id = ?',
          whereArgs: [item.messageId],
          limit: 1,
        );
        if (previous.isNotEmpty &&
            (previous.single['conversation_id'] != conversationId ||
                previous.single['sequence'] != item.sequence)) {
          throw StateError('Server message identity/sequence changed');
        }
        // Once a server tombstone is observed, replay of an older cached
        // history page must never restore the deleted plaintext.
        if (previous.isNotEmpty &&
            previous.single['deleted'] == 1 &&
            !item.deleted) {
          continue;
        }
        final row = <String, Object?>{
          'message_id': item.messageId,
          'conversation_id': conversationId,
          'sender_user_id': item.senderUserId,
          'sequence': item.sequence,
          'client_request_id': item.clientRequestId,
          'body': item.deleted ? null : item.body,
          'created_at_ms': item.createdAtMs,
          'deleted': item.deleted ? 1 : 0,
        };
        if (previous.isEmpty) {
          await tx.insert('messages', row, conflictAlgorithm: ConflictAlgorithm.abort);
        } else {
          await tx.update('messages', row,
              where: 'message_id = ?', whereArgs: [item.messageId]);
        }
        if (item.clientRequestId case final requestId?) {
          // A different conversation cannot accidentally acknowledge its send.
          await tx.delete('outbox',
              where: 'request_id = ? AND conversation_id = ?',
              whereArgs: [requestId, conversationId]);
        }
      }
      if (nextSyncSequence != null) {
        await tx.rawInsert('''
          INSERT INTO sync_cursors(conversation_id,sequence) VALUES (?,?)
          ON CONFLICT(conversation_id) DO UPDATE SET
            sequence=MAX(sync_cursors.sequence,excluded.sequence)
        ''', [conversationId, nextSyncSequence]);
      }
    });
  }

  Future<List<CachedHumanMessage>> history({
    required String tenantId,
    required String userId,
    required String conversationId,
    int? beforeSequence,
    int limit = 40,
  }) async {
    if (limit < 1 || limit > 50 || (beforeSequence != null && beforeSequence <= 0)) {
      throw const FormatException('Invalid history page cursor');
    }
    final db = _forAccount(tenantId, userId);
    final rows = await db.query(
      'messages',
      where: beforeSequence == null
          ? 'conversation_id = ?'
          : 'conversation_id = ? AND sequence < ?',
      whereArgs: beforeSequence == null
          ? [conversationId]
          : [conversationId, beforeSequence],
      orderBy: 'sequence DESC',
      limit: limit,
    );
    return List.unmodifiable(rows.map(CachedHumanMessage.fromRow));
  }

  Future<int> syncCursor({
    required String tenantId,
    required String userId,
    required String conversationId,
  }) async {
    final rows = await _forAccount(tenantId, userId).query(
      'sync_cursors',
      columns: ['sequence'],
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      limit: 1,
    );
    return rows.isEmpty ? 0 : rows.single['sequence'] as int;
  }

  /// Enqueue before the first network attempt. Never generate a different ID
  /// for retry: the Gateway must apply exactly-once client idempotency.
  Future<void> queueText({
    required String tenantId,
    required String userId,
    required String conversationId,
    required String requestId,
    required String body,
    required int createdAtMs,
  }) async {
    if (conversationId.isEmpty ||
        requestId.length < 12 ||
        requestId.length > 128 ||
        body.trim().isEmpty ||
        body.length > 4000) {
      throw const FormatException('Invalid offline message');
    }
    final db = _forAccount(tenantId, userId);
    await db.transaction((tx) async {
      final rows = await tx.query('outbox',
          where: 'request_id = ?', whereArgs: [requestId], limit: 1);
      if (rows.isNotEmpty) {
        if (rows.single['conversation_id'] != conversationId ||
            rows.single['body'] != body) {
          throw StateError('Duplicate request ID with different message content');
        }
        return;
      }
      await tx.insert('outbox', {
        'request_id': requestId,
        'conversation_id': conversationId,
        'body': body,
        'created_at_ms': createdAtMs,
        'retry_after_ms': 0,
        'status': 'pending',
      });
    });
  }

  Future<List<CachedHumanOutboxItem>> pending({
    required String tenantId,
    required String userId,
    required int nowMs,
    int limit = 20,
  }) async {
    if (limit < 1 || limit > 50) throw RangeError.range(limit, 1, 50);
    final rows = await _forAccount(tenantId, userId).query(
      'outbox',
      where: "status IN ('pending','unknown') AND retry_after_ms <= ?",
      whereArgs: [nowMs],
      orderBy: 'created_at_ms ASC, request_id ASC',
      limit: limit,
    );
    return List.unmodifiable(rows.map(CachedHumanOutboxItem.fromRow));
  }

  /// All visible queued/uncertain/blocked items for this thread, not only
  /// those whose retry deadline has elapsed. Used for truthful offline UI.
  Future<List<CachedHumanOutboxItem>> queuedForConversation({
    required String tenantId,
    required String userId,
    required String conversationId,
    int limit = 50,
  }) async {
    if (limit < 1 || limit > 50) throw RangeError.range(limit, 1, 50);
    final rows = await _forAccount(tenantId, userId).query(
      'outbox',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      orderBy: 'created_at_ms DESC,request_id DESC',
      limit: limit,
    );
    return List.unmodifiable(rows.map(CachedHumanOutboxItem.fromRow));
  }

  Future<void> markAttempt({
    required String tenantId,
    required String userId,
    required String requestId,
    required HumanOutboxStatus status,
    required int retryAfterMs,
  }) async {
    if (retryAfterMs < 0) throw RangeError.value(retryAfterMs);
    final updated = await _forAccount(tenantId, userId).rawUpdate('''
      UPDATE outbox SET status = ?, attempts = attempts + 1,
        retry_after_ms = ? WHERE request_id = ?
    ''', [status.name, retryAfterMs, requestId]);
    if (updated != 1) throw StateError('Pending request no longer exists');
  }

  /// Explicit confirmed server receipt only. An HTTP timeout, cancelled send,
  /// 401 or 5xx must NOT call this.
  Future<void> acknowledge({
    required String tenantId,
    required String userId,
    required String conversationId,
    required String requestId,
    required CachedHumanMessage serverMessage,
  }) {
    if (serverMessage.clientRequestId != requestId ||
        serverMessage.conversationId != conversationId) {
      throw StateError('Receipt does not match original message identity');
    }
    return applyServerPage(
      tenantId: tenantId,
      userId: userId,
      conversationId: conversationId,
      messages: [serverMessage],
      nextSyncSequence: null,
    );
  }

  /// Bounded local optimization only. Server history remains authoritative.
  Future<void> pruneConversation({
    required String tenantId,
    required String userId,
    required String conversationId,
    int retain = 500,
  }) async {
    if (retain < 50 || retain > 2000) throw RangeError.range(retain, 50, 2000);
    await _forAccount(tenantId, userId).rawDelete('''
      DELETE FROM messages WHERE conversation_id = ?
      AND message_id NOT IN (
        SELECT message_id FROM messages WHERE conversation_id = ?
        ORDER BY sequence DESC LIMIT ?
      )
    ''', [conversationId, conversationId, retain]);
  }
}
