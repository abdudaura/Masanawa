import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/twin_directory.dart';
import '../agents/twin_directory_http_transport.dart';
import '../core/providers.dart';

final twinDirectoryTransportProvider = Provider<TwinDirectoryTransport>(
  (ref) => GatewayTwinDirectoryTransport(api: ref.watch(apiClientProvider)),
);

class TwinDirectoryState {
  const TwinDirectoryState({
    this.query = '',
    this.items = const [],
    this.nextCursor,
    this.loading = false,
    this.loadingMore = false,
    this.error,
  });

  final String query;
  final List<TwinDirectoryEntry> items;
  final String? nextCursor;
  final bool loading;
  final bool loadingMore;
  final String? error;

  TwinDirectoryState copyWith({
    String? query,
    List<TwinDirectoryEntry>? items,
    String? nextCursor,
    bool clearCursor = false,
    bool? loading,
    bool? loadingMore,
    String? error,
    bool clearError = false,
  }) {
    return TwinDirectoryState(
      query: query ?? this.query,
      items: items ?? this.items,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class TwinDirectoryController extends StateNotifier<TwinDirectoryState> {
  TwinDirectoryController(this._transport) : super(const TwinDirectoryState());

  final TwinDirectoryTransport _transport;
  Timer? _debounce;

  Future<void> loadInitial() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final page = await _transport.search(query: state.query);
      state = TwinDirectoryState(
        query: state.query,
        items: page.items,
        nextCursor: page.nextCursor,
      );
    } catch (_) {
      state = state.copyWith(
        loading: false,
        error: 'Could not load twins right now.',
      );
    }
  }

  void setQuery(String value) {
    final query = value.trim();
    state = state.copyWith(query: query, clearCursor: true, clearError: true);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), loadInitial);
  }

  Future<void> loadMore() async {
    final cursor = state.nextCursor;
    if (cursor == null || state.loading || state.loadingMore) return;
    state = state.copyWith(loadingMore: true, clearError: true);
    try {
      final page = await _transport.search(
        query: state.query,
        cursor: cursor,
      );
      final seen = state.items.map((item) => item.publicId).toSet();
      final merged = [
        ...state.items,
        for (final item in page.items)
          if (seen.add(item.publicId)) item,
      ];
      state = TwinDirectoryState(
        query: state.query,
        items: merged,
        nextCursor: page.nextCursor,
      );
    } catch (_) {
      state = state.copyWith(
        loadingMore: false,
        error: 'Could not load more twins.',
      );
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

final twinDirectoryProvider =
    StateNotifierProvider<TwinDirectoryController, TwinDirectoryState>(
  (ref) => TwinDirectoryController(ref.watch(twinDirectoryTransportProvider)),
);
