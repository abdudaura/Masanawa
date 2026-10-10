import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'public_discovery_models.dart';
import 'public_discovery_transport.dart';

/// Per signed-in account; no on-device persistence of people/search results.
/// The parent must close() on logout and supply current account fencing.
class PublicDiscoveryController extends ChangeNotifier {
  PublicDiscoveryController({
    required PublicDiscoveryTransport transport,
    required String ownerId,
    required bool Function(String ownerId) isCurrentOwner,
  }) : _transport = transport, _ownerId = ownerId,
       _isCurrentOwner = isCurrentOwner;

  final PublicDiscoveryTransport _transport;
  final String _ownerId;
  final bool Function(String ownerId) _isCurrentOwner;
  int _epoch = 0;
  bool _closed = false;

  String query = '';
  PublicDiscoveryFilter filter = PublicDiscoveryFilter.all;
  bool liveOnly = false;
  bool loading = false;
  bool loadingMore = false;
  String? error;
  bool saturated = false;
  int? nextOffset;
  List<PublicDiscoveryItem> items = const [];

  bool get authorized => !_closed && _ownerId.isNotEmpty && _isCurrentOwner(_ownerId);

  static String safeError(Object exception) {
    if (exception is DioException) {
      return switch (exception.response?.statusCode) {
        401 => 'Your session has ended. Sign in again.',
        403 => 'This search is not available for your account.',
        404 => 'Search is not available on this server yet.',
        429 => 'Too many searches. Please try later.',
        _ => 'Could not reach search. Check your connection and retry.',
      };
    }
    if (exception is FormatException) return 'Search response was invalid. Try later.';
    return 'Search could not be completed. Try again.';
  }

  void clear() {
    ++_epoch;
    query = '';
    items = const [];
    nextOffset = null;
    error = null;
    loading = false;
    loadingMore = false;
    saturated = false;
    if (!_closed) notifyListeners();
  }

  Future<void> search(String rawQuery, {
    PublicDiscoveryFilter? newFilter,
    bool? newLiveOnly,
  }) async {
    if (!authorized) { clear(); return; }
    final value = rawQuery.trim().replaceAll(RegExp(r'\s+'), ' ');
    final epoch = ++_epoch;
    query = value;
    if (newFilter != null) filter = newFilter;
    if (newLiveOnly != null) liveOnly = newLiveOnly;
    items = const [];
    nextOffset = null;
    error = null;
    saturated = false;
    if (value.length < 2) {
      loading = false;
      notifyListeners();
      return;
    }
    loading = true;
    loadingMore = false;
    notifyListeners();
    try {
      final response = await _transport.search(
        query: value, filter: filter, liveOnly: liveOnly, offset: 0,
      );
      if (!authorized || epoch != _epoch) return;
      items = response.items;
      nextOffset = response.nextOffset;
      saturated = response.searchWindowSaturated;
    } catch (exception) {
      if (!authorized || epoch != _epoch) return;
      error = safeError(exception);
    } finally {
      if (authorized && epoch == _epoch) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadMore() async {
    final offset = nextOffset;
    if (!authorized || loading || loadingMore || offset == null) return;
    final epoch = _epoch;
    loadingMore = true;
    error = null;
    notifyListeners();
    try {
      final response = await _transport.search(
        query: query, filter: filter, liveOnly: liveOnly, offset: offset,
      );
      if (!authorized || epoch != _epoch) return;
      // Do not trust duplicate or regressing cursors from bad deployments.
      if (response.nextOffset != null && response.nextOffset! <= offset) {
        throw const FormatException('Invalid public discovery cursor');
      }
      items = List.unmodifiable([...items, ...response.items]);
      nextOffset = response.nextOffset;
      saturated = response.searchWindowSaturated;
    } catch (exception) {
      if (!authorized || epoch != _epoch) return;
      error = safeError(exception);
      // Preserve current page on ambiguous read errors for an explicit retry.
    } finally {
      if (authorized && epoch == _epoch) {
        loadingMore = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _closed = true;
    ++_epoch;
    items = const [];
    super.dispose();
  }
}
