import 'dart:math';

import 'human_chat_cache.dart';
import 'human_chat_models.dart';

/// A C02/C03 transport must return validated, authenticated server snapshots.
/// Never supply local AI-chat messages or public Talk comments as DM history.
abstract interface class HumanChatRemote {
  Future<List<CachedHumanThread>> fetchRecentThreads({int limit = 40});
  Future<HumanChatDelta> fetchDelta({
    required String conversationId,
    required int afterSequence,
    int limit = 50,
  });
  Future<CachedHumanMessage> sendText({
    required String conversationId,
    required String requestId,
    required String body,
  });
}

class HumanChatDelta {
  const HumanChatDelta({
    required this.messages,
    required this.nextSequence,
    required this.hasMore,
  });
  final List<CachedHumanMessage> messages;
  final int nextSequence;
  final bool hasMore;
}

/// Server rejected the send definitively. Network/timeouts and HTTP 5xx are
/// not proof of rejection, so those MUST retain the identical request ID.
class HumanChatRejected implements Exception {
  const HumanChatRejected(this.code);
  final String code;
}

typedef HumanChatNowMs = int Function();

/// Offline-first reconciliation engine. This is NOT a background service:
/// callers may invoke it on entry, connectivity regain or foreground resume.
/// The server alone decides membership, receipt and delivery.
class HumanChatSync {
  HumanChatSync({
    required this.cache,
    required this.remote,
    required this.tenantId,
    required this.userId,
    HumanChatNowMs? nowMs,
  }) : _nowMs = nowMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  final HumanChatCache cache;
  final HumanChatRemote remote;
  final String tenantId;
  final String userId;
  final HumanChatNowMs _nowMs;
  Future<void>? _flush;
  bool _active = true;

  void deactivate() => _active = false;
  void _assertActive() {
    if (!_active) throw StateError('Human chat session is no longer active');
  }

  Future<List<CachedHumanThread>> cachedThreads() {
    _assertActive();
    return cache.recentThreads(tenantId: tenantId, userId: userId);
  }

  Future<List<CachedHumanMessage>> cachedHistory(
    String conversationId, {
    int? beforeSequence,
  }) {
    _assertActive();
    return cache.history(
      tenantId: tenantId,
      userId: userId,
      conversationId: conversationId,
      beforeSequence: beforeSequence,
    );
  }

  Future<List<CachedHumanOutboxItem>> cachedOutbox(
    String conversationId,
  ) {
    _assertActive();
    return cache.queuedForConversation(
      tenantId: tenantId, userId: userId, conversationId: conversationId,
    );
  }

  Future<void> refreshThreads() async {
    _assertActive();
    final threads = await remote.fetchRecentThreads();
    _assertActive();
    if (threads.length > 50) throw const FormatException('Unbounded inbox page');
    for (final thread in threads) {
      _assertActive();
      await cache.saveThread(
        tenantId: tenantId, userId: userId, thread: thread,
      );
    }
  }

  /// Applies bounded, server-ordered pages; highwater is committed atomically
  /// with messages. A crash resumes from the previous *persisted* cursor.
  Future<void> catchUp(String conversationId, {int maxPages = 5}) async {
    _assertActive();
    if (maxPages < 1 || maxPages > 20) throw RangeError.range(maxPages, 1, 20);
    for (var page = 0; page < maxPages; page += 1) {
      _assertActive();
      final cursor = await cache.syncCursor(
        tenantId: tenantId, userId: userId, conversationId: conversationId,
      );
      HumanChatDelta delta;
      try {
        delta = await remote.fetchDelta(
          conversationId: conversationId, afterSequence: cursor,
        );
      } on HumanChatRejected catch (error) {
        if (!_active) return;
        if (error.code == 'ACCESS_REVOKED' ||
            error.code == 'CONVERSATION_DELETED') {
          await cache.revokeConversation(
            tenantId: tenantId,
            userId: userId,
            conversationId: conversationId,
          );
        }
        rethrow;
      }
      _assertActive();
      if (delta.nextSequence < cursor ||
          delta.messages.length > 100 ||
          (delta.hasMore && delta.nextSequence == cursor)) {
        throw const FormatException('Server returned invalid delta cursor');
      }
      await cache.applyServerPage(
        tenantId: tenantId,
        userId: userId,
        conversationId: conversationId,
        messages: delta.messages,
        nextSyncSequence: delta.nextSequence,
      );
      if (!delta.hasMore) return;
    }
    // Remaining pages are intentionally fetched on another user/foreground
    // cycle; never spin or fetch a full history on first paint.
  }

  static String newRequestId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }

  /// Persist BEFORE any network operation and return immediately for
  /// local-first rendering. A separate [flushPending] may run or be retried.
  Future<String> queueText(
    String conversationId,
    String body,
  ) async {
    _assertActive();
    final requestId = newRequestId();
    await cache.queueText(
      tenantId: tenantId, userId: userId,
      conversationId: conversationId,
      requestId: requestId,
      body: body,
      createdAtMs: _nowMs(),
    );
    return requestId;
  }

  Future<String> queueAndTrySend(String conversationId, String body) async {
    final requestId = await queueText(conversationId, body);
    if (_active) await flushPending();
    return requestId;
  }

  Future<void> flushPending() {
    _assertActive();
    final active = _flush;
    if (active != null) return active;
    final started = _flushOnce();
    _flush = started;
    return started.whenComplete(() {
      if (identical(_flush, started)) _flush = null;
    });
  }

  Future<void> _flushOnce() async {
    final pending = await cache.pending(
      tenantId: tenantId, userId: userId, nowMs: _nowMs(),
    );
    for (final item in pending) {
      if (!_active) return;
      try {
        final acknowledged = await remote.sendText(
          conversationId: item.conversationId,
          requestId: item.requestId,
          body: item.body,
        );
        if (!_active) return;
        await cache.acknowledge(
          tenantId: tenantId,
          userId: userId,
          conversationId: item.conversationId,
          requestId: item.requestId,
          serverMessage: acknowledged,
        );
      } on HumanChatRejected {
        if (!_active) return;
        await cache.markAttempt(
          tenantId: tenantId, userId: userId, requestId: item.requestId,
          status: HumanOutboxStatus.blocked, retryAfterMs: 0,
        );
      } catch (_) {
        if (!_active) return;
        final exponent = min(item.attempts, 9);
        final backoffMs = min(1800000, 2000 * (1 << exponent));
        await cache.markAttempt(
          tenantId: tenantId, userId: userId, requestId: item.requestId,
          status: HumanOutboxStatus.unknown,
          retryAfterMs: _nowMs() + backoffMs,
        );
      }
    }
  }
}
