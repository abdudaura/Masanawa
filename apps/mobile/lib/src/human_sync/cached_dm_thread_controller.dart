import 'package:flutter/foundation.dart';

import '../core/request_id.dart';
import 'dm_sync_coordinator.dart';
import 'protected_dm_cache.dart';

/// Reusable offline-first state for C02's real authenticated human DM screen.
/// No agent threads, fake contacts or alternative root router.
class CachedDmThreadController extends ChangeNotifier {
  CachedDmThreadController({
    required this.conversationId,
    required this.sync,
  });
  final String conversationId;
  final DmSyncCoordinator sync;

  List<Map<String, dynamic>> messages = const [];
  List<DmQueuedMessage> outbox = const [];
  bool loading = false;
  bool refreshing = false;
  bool loadingOlder = false;
  String? error;
  String? nextBefore;
  bool _disposed = false;
  int _revision = 0;

  void _emit() { if (!_disposed) notifyListeners(); }
  void _active() {
    if (_disposed || !sync.active) throw StateError('Human DM account unavailable');
  }

  /// Can render this snapshot without touching the network.
  Future<void> restore() async {
    _active();
    final myRevision = _revision;
    loading = true;
    _emit();
    try {
      final cached = await sync.cache.messages(conversationId);
      final queued = await sync.cache.pending();
      _active();
      if (myRevision != _revision) return;
      messages = cached;
      outbox = queued.where((m) => m.conversationId == conversationId).toList();
      nextBefore = cached.isEmpty ? null : cached.last['sequence'] as String?;
      error = null;
    } catch (_) {
      error = 'Private local history is unavailable. Connect to reload from server.';
    } finally {
      loading = false;
      _emit();
    }
  }

  /// Server data always takes precedence; an offline error keeps cached rows.
  Future<void> refresh() async {
    _active();
    final myRevision = _revision;
    refreshing = true; error = null; _emit();
    try {
      await sync.refreshThread(conversationId);
      _active();
      if (myRevision != _revision) return;
      await restore();
    } catch (_) {
      if (!_disposed && myRevision == _revision) {
        error = 'Could not refresh messages. Cached history may be out of date.';
      }
    } finally {
      refreshing = false; _emit();
    }
  }

  Future<void> older() async {
    _active();
    if (loadingOlder || nextBefore == null) return;
    loadingOlder = true; error = null; _emit();
    final before = nextBefore!;
    try {
      // C02 keyset paging. C03 owns the later delta cursor and events.
      await sync.refreshThread(conversationId, before: before);
      _active();
      messages = await sync.cache.messages(conversationId, limit: 50);
      // Rendering appends pages from the same indexed cache via page(offset).
      final olderPage = await sync.cache.messages(conversationId,
          limit: 50, before: before);
      final seen = messages.map((m) => m['messageId']).toSet();
      messages = [...messages, ...olderPage.where((m) => seen.add(m['messageId']))];
      nextBefore = messages.isEmpty ? null : messages.last['sequence'] as String?;
    } catch (_) {
      error = 'Older messages unavailable. Retry when connected.';
    } finally {
      loadingOlder = false; _emit();
    }
  }

  /// The local row is queued until C02 confirms the SAME server request ID.
  Future<DmSendOutcome> send(String rawText) async {
    _active();
    final text = rawText.trim();
    final requestId = createRequestId();
    await sync.enqueue(
        conversationId: conversationId, requestId: requestId, text: text);
    await _refreshOutbox();
    final item = (await sync.cache.pending()).singleWhere(
        (m) => m.requestId == requestId);
    final outcome = await sync.sendOnce(item);
    if (sync.active && !_disposed) {
      await restore();
      if (outcome == DmSendOutcome.uncertain) {
        error = 'Not confirmed. Retry with the same message ID.';
      } else if (outcome == DmSendOutcome.rejected) {
        error = 'The server rejected this message. Review before retrying.';
      }
      _emit();
    }
    return outcome;
  }

  Future<DmSendOutcome> retry(DmQueuedMessage item) async {
    _active();
    if (item.conversationId != conversationId) {
      throw ArgumentError('Message belongs to another conversation');
    }
    final outcome = await sync.sendOnce(item);
    if (!_disposed && sync.active) await restore();
    return outcome;
  }

  Future<void> discard(DmQueuedMessage item) async {
    _active();
    if (item.conversationId != conversationId) {
      throw ArgumentError('Message belongs to another conversation');
    }
    await sync.cache.discard(item.requestId);
    await _refreshOutbox();
  }

  Future<void> _refreshOutbox() async {
    if (_disposed || !sync.active) return;
    outbox = (await sync.cache.pending())
        .where((m) => m.conversationId == conversationId).toList();
    _emit();
  }

  /// C08/session owner must call on logout, account switching or route removal.
  /// ADB wipeAccount is intentionally separate from navigation dispose.
  @override
  void dispose() {
    _disposed = true;
    _revision++;
    super.dispose();
  }
}
