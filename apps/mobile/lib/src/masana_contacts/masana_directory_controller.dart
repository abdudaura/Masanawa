import 'dart:async';

import 'package:flutter/foundation.dart';

import '../agents/twin_directory.dart';

/// Public persona discovery is distinct from authenticated human contact
/// admission. No phone numbers or human IDs are accepted in this controller.
class MasanaDirectoryController extends ChangeNotifier {
  MasanaDirectoryController({
    required TwinDirectoryTransport transport,
    required this.accountId,
    required this.isCurrentAccount,
    Duration searchDelay = const Duration(milliseconds: 300),
  })  : _transport = transport,
        _searchDelay = searchDelay;

  final TwinDirectoryTransport _transport;
  final String accountId;
  final bool Function(String accountId) isCurrentAccount;
  final Duration _searchDelay;

  Timer? _searchTimer;
  bool _disposed = false;
  int _generation = 0;
  int _selection = 0;

  String query = '';
  List<TwinDirectoryEntry> items = const [];
  String? nextCursor;
  String? error;
  bool loading = false;
  bool loadingMore = false;
  String? openingPublicId;

  bool get _authorized =>
      !_disposed && accountId.trim().isNotEmpty && isCurrentAccount(accountId);

  /// A failed/expired session never leaves actionable cached persona entries.
  bool get canInteract => _authorized && !loading && !loadingMore;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void setQuery(String raw) {
    _searchTimer?.cancel();
    ++_generation;
    ++_selection;
    query = raw.trim();
    items = const [];
    nextCursor = null;
    error = null;
    loading = false;
    loadingMore = false;
    openingPublicId = null;
    if (!_authorized) {
      _notify();
      return;
    }
    if (query.length > 80) {
      error = 'Search must be 80 characters or fewer.';
      _notify();
      return;
    }
    _notify();
    _searchTimer = Timer(_searchDelay, () { unawaited(loadInitial()); });
  }

  Future<void> loadInitial() async {
    _searchTimer?.cancel();
    if (!_authorized) {
      invalidate();
      return;
    }
    if (query.length > 80) return;
    final generation = ++_generation;
    ++_selection;
    loading = true;
    loadingMore = false;
    openingPublicId = null;
    items = const [];
    nextCursor = null;
    error = null;
    _notify();
    try {
      final page = await _transport.search(query: query, limit: 30);
      if (!_authorized || generation != _generation) return;
      final seen = <String>{};
      items = List.unmodifiable(page.items.where((entry) =>
          entry.publicId.trim().isNotEmpty &&
          entry.characterId.trim().isNotEmpty &&
          seen.add(entry.publicId)));
      nextCursor = page.nextCursor;
      loading = false;
      _notify();
    } catch (_) {
      if (!_authorized || generation != _generation) return;
      loading = false;
      error = 'Could not load Masana. Check your connection and retry.';
      _notify();
    }
  }

  Future<void> loadMore() async {
    final cursor = nextCursor;
    if (!_authorized || loading || loadingMore || cursor == null) return;
    final generation = _generation;
    loadingMore = true;
    error = null;
    _notify();
    try {
      final page = await _transport.search(
          query: query, cursor: cursor, limit: 30);
      if (!_authorized || generation != _generation) return;
      if (page.nextCursor == cursor) {
        throw const FormatException('Repeated directory cursor');
      }
      final seen = items.map((entry) => entry.publicId).toSet();
      items = List.unmodifiable([
        ...items,
        ...page.items.where((entry) =>
            entry.publicId.trim().isNotEmpty &&
            entry.characterId.trim().isNotEmpty &&
            seen.add(entry.publicId)),
      ]);
      nextCursor = page.nextCursor;
      loadingMore = false;
      _notify();
    } catch (_) {
      if (!_authorized || generation != _generation) return;
      loadingMore = false;
      error = 'Could not load more Masana. Try again.';
      _notify();
    }
  }

  /// Server resolve prevents a stale search row from opening a deleted,
  /// re-mapped or no-longer-public character. Routing uses PUBLIC persona IDs.
  Future<void> open(
    TwinDirectoryEntry requested,
    void Function(TwinDirectoryEntry verified) onOpen,
  ) async {
    if (!_authorized || loading || loadingMore || openingPublicId != null ||
        !items.any((entry) =>
            entry.publicId == requested.publicId &&
            entry.characterId == requested.characterId)) {
      return;
    }
    final generation = _generation;
    final selection = ++_selection;
    openingPublicId = requested.publicId;
    error = null;
    _notify();
    try {
      final fresh = await _transport.resolve(publicId: requested.publicId);
      if (!_authorized || generation != _generation ||
          selection != _selection) return;
      if (fresh == null ||
          fresh.publicId != requested.publicId ||
          fresh.characterId != requested.characterId) {
        error = 'This Masana is no longer available. Refresh the directory.';
        return;
      }
      // The callback must not be invoked after an account change or cancellation.
      onOpen(fresh);
    } catch (_) {
      if (_authorized && generation == _generation &&
          selection == _selection) {
        error = 'Could not verify this Masana. Try again.';
      }
    } finally {
      if (_authorized && generation == _generation &&
          selection == _selection) {
        openingPublicId = null;
        _notify();
      }
    }
  }

  /// Called when leaving Masana, signing out or switching accounts.
  /// In-flight results are discarded even when the transport ignores cancel.
  void invalidate() {
    _searchTimer?.cancel();
    ++_generation;
    ++_selection;
    items = const [];
    nextCursor = null;
    error = null;
    openingPublicId = null;
    loading = false;
    loadingMore = false;
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    _searchTimer?.cancel();
    ++_generation;
    ++_selection;
    super.dispose();
  }
}
