import 'package:flutter/foundation.dart';
import 'human_message_search_models.dart';
import 'human_message_search_transport.dart';

/// Private, ephemeral state. Parent MUST switchAccount on login/logout/refresh
/// before showing another person's messages. Never persists search terms or hits.
class HumanMessageSearchController extends ChangeNotifier {
  HumanMessageSearchController(this.transport);
  final HumanMessageSearchTransport transport;
  String? _account;
  int _epoch = 0;
  bool _disposed = false;
  bool busy = false, loadingMore = false;
  String? error, next, activeQuery, conversationId;
  List<HumanMessageSearchHit> hits = const [];

  void switchAccount(String? accountKey) {
    if (_account == accountKey) return;
    _account = accountKey;
    _epoch++;
    busy = false;
    loadingMore = false;
    activeQuery = null;
    conversationId = null;
    next = null;
    error = null;
    hits = const [];
    _publish();
  }
  Future<void> find(String text, {String? inConversation}) async {
    final account = _account;
    final query = text.trim();
    final generation = ++_epoch;
    hits = const [];
    next = null;
    error = null;
    activeQuery = query;
    conversationId = inConversation;
    busy = account != null && query.runes.length >= 2;
    loadingMore = false;
    _publish();
    if (!busy) {
      if (account != null && query.isNotEmpty) error = 'Enter at least 2 characters.';
      _publish();
      return;
    }
    try {
      final page = await transport.search(text: query, conversationId: inConversation);
      if (!_isCurrent(account, generation)) return;
      hits = page.hits;
      next = page.next;
    } catch (_) {
      if (!_isCurrent(account, generation)) return;
      error = 'Search is unavailable. Check your connection and try again.';
    } finally {
      if (_isCurrent(account, generation)) {
        busy = false;
        _publish();
      }
    }
  }
  Future<void> loadMore() async {
    final account = _account, query = activeQuery, cursor = next;
    if (_disposed || account == null || query == null ||
        cursor == null || busy || loadingMore) return;
    final generation = _epoch;
    loadingMore = true;
    error = null;
    _publish();
    try {
      final page = await transport.search(
        text: query, conversationId: conversationId, after: cursor);
      if (!_isCurrent(account, generation)) return;
      // Duplicate UI rows on overlapping snapshots must never look like distinct messages.
      final seen = hits.map((hit) => hit.messageId).toSet();
      hits = List.unmodifiable([...hits, ...page.hits.where((hit) => seen.add(hit.messageId))]);
      next = page.next;
    } catch (_) {
      if (!_isCurrent(account, generation)) return;
      error = 'More results could not be loaded. Retry to continue.';
    } finally {
      if (_isCurrent(account, generation)) {
        loadingMore = false;
        _publish();
      }
    }
  }
  bool _isCurrent(String? account, int generation) =>
      !_disposed && _account == account && _epoch == generation;
  void _publish() { if (!_disposed) notifyListeners(); }
  @override
  void dispose() { _disposed = true; _epoch++; super.dispose(); }
}
