import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import 'human_contacts_transport.dart';

final humanContactsTransportProvider = Provider<HumanContactsTransport>(
  (ref) => GatewayHumanContactsTransport(api: ref.watch(apiClientProvider)),
);

class HumanContactsViewState {
  const HumanContactsViewState({
    this.loading = true,
    this.searching = false,
    this.busy = false,
    this.loadingMore = false,
    this.nextCursor,
    this.preferences,
    this.contacts = const [],
    this.lookup,
    this.lookupHandle,
    this.error,
    this.notice,
  });

  final bool loading;
  final bool searching;
  final bool busy;
  final bool loadingMore;
  final String? nextCursor;
  final HumanContactPreferences? preferences;
  final List<HumanContact> contacts;
  final HumanContact? lookup;
  final String? lookupHandle;
  final String? error;
  final String? notice;

  HumanContactsViewState copyWith({
    bool? loading,
    bool? searching,
    bool? busy,
    bool? loadingMore,
    String? nextCursor,
    bool clearNextCursor = false,
    HumanContactPreferences? preferences,
    bool clearPreferences = false,
    List<HumanContact>? contacts,
    HumanContact? lookup,
    String? lookupHandle,
    bool clearLookup = false,
    bool clearError = false,
    bool clearNotice = false,
    String? error,
    String? notice,
  }) => HumanContactsViewState(
    loading: loading ?? this.loading,
    searching: searching ?? this.searching,
    busy: busy ?? this.busy,
    loadingMore: loadingMore ?? this.loadingMore,
    nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
    preferences: clearPreferences ? null : preferences ?? this.preferences,
    contacts: contacts ?? this.contacts,
    lookup: clearLookup ? null : lookup ?? this.lookup,
    lookupHandle: clearLookup ? null : lookupHandle ?? this.lookupHandle,
    error: clearError ? null : error ?? this.error,
    notice: clearNotice ? null : notice ?? this.notice,
  );
}

/// One controller is scoped to an authenticated account AND its current session
/// lifetime. No contact data is persisted or shared with public/AI chat caches.
final humanContactsProvider = StateNotifierProvider.autoDispose<
    HumanContactsController, HumanContactsViewState>((ref) {
  final session = ref.watch(sessionProvider);
  final owner = session is SessionSignedIn ? session.user.id : null;
  final transport = ref.watch(humanContactsTransportProvider);
  return HumanContactsController(
    transport: transport,
    ownerId: owner,
    isStillOwner: () {
      final current = ref.read(sessionProvider);
      return current is SessionSignedIn && current.user.id == owner;
    },
  );
});

class HumanContactsController extends StateNotifier<HumanContactsViewState> {
  HumanContactsController({
    required HumanContactsTransport transport,
    required String? ownerId,
    required bool Function() isStillOwner,
  })  : _transport = transport,
        _ownerId = ownerId,
        _isStillOwner = isStillOwner,
        super(HumanContactsViewState(loading: ownerId != null)) {
    if (ownerId != null) unawaited(refresh());
  }

  final HumanContactsTransport _transport;
  final String? _ownerId;
  final bool Function() _isStillOwner;
  int _readEpoch = 0;
  int _searchEpoch = 0;

  bool get _authorized =>
      mounted && _ownerId != null && _isStillOwner();

  static String _errorText(Object error) {
    if (error is DioException) {
      return switch (error.response?.statusCode) {
        401 => 'Your session expired. Sign in again.',
        403 => 'This action is not permitted.',
        404 => 'Contact or request unavailable.',
        429 => 'Too many requests. Try again later.',
        _ => 'Could not connect. Check your connection and retry.',
      };
    }
    if (error is FormatException) return error.message;
    return 'Could not complete that action. Try again.';
  }

  Future<void> refresh() async {
    // A read while a consent/privacy write is pending can overwrite the
    // authoritative post-write readback. The mutation owns that refresh.
    if (!_authorized || state.busy) return;
    final epoch = ++_readEpoch;
    // Full reload is an authorization boundary, not a background decoration.
    // A previously accepted contact may have revoked or blocked this account
    // since the last read. Never leave stale rights (including a prior lookup
    // and its Message action) usable while readback is pending or if it fails.
    // A scoped, protected offline directory would need an explicit stale,
    // non-sendable state; this controller intentionally has no such cache.
    ++_searchEpoch;
    state = state.copyWith(
      loading: true,
      loadingMore: false,
      searching: false,
      contacts: const <HumanContact>[],
      clearPreferences: true,
      clearLookup: true,
      clearNextCursor: true,
      clearError: true,
      clearNotice: true,
    );
    try {
      final results = await Future.wait<Object>([
        _transport.preferences(),
        _transport is HumanContactsPaginationTransport
            ? (_transport as HumanContactsPaginationTransport).page(limit: 50)
            : _transport.list(limit: 50),
      ]);
      if (!_authorized || epoch != _readEpoch) return;
      final result = results[1];
      state = state.copyWith(
        loading: false,
        preferences: results[0] as HumanContactPreferences,
        contacts: result is HumanContactPage
            ? result.contacts : result as List<HumanContact>,
        nextCursor: result is HumanContactPage ? result.nextCursor : null,
        clearNextCursor: result is! HumanContactPage ||
            result.nextCursor == null,
      );
    } catch (error) {
      if (!_authorized || epoch != _readEpoch) return;
      state = state.copyWith(loading: false, error: _errorText(error));
    }
  }

  /// Continue only the current signed-in account's authoritative cursor.
  /// A concurrent refresh, logout or account change invalidates this result.
  Future<void> loadMore() async {
    if (!_authorized || state.loading || state.loadingMore || state.busy ||
        state.nextCursor == null ||
        _transport is! HumanContactsPaginationTransport) return;
    final epoch = _readEpoch;
    final cursor = state.nextCursor!;
    state = state.copyWith(loadingMore: true, clearError: true);
    try {
      final page = await (_transport as HumanContactsPaginationTransport)
          .page(limit: 50, cursor: cursor);
      if (!_authorized || epoch != _readEpoch) return;
      final seen = state.contacts.map((contact) => contact.userId).toSet();
      final combined = [
        ...state.contacts,
        ...page.contacts.where((contact) => seen.add(contact.userId)),
      ];
      state = state.copyWith(
        contacts: List.unmodifiable(combined),
        loadingMore: false,
        nextCursor: page.nextCursor,
        clearNextCursor: page.nextCursor == null,
      );
    } catch (error) {
      if (!_authorized || epoch != _readEpoch) return;
      state = state.copyWith(loadingMore: false, error: _errorText(error));
    }
  }

  Future<void> findByHandle(String handle) async {
    // Do not expose a previously eligible contact while a revoke or policy
    // mutation is in flight. A fresh lookup is allowed after it settles.
    if (!_authorized || state.busy) return;
    final raw = handle.trim();
    final epoch = ++_searchEpoch;
    if (raw.isEmpty) {
      state = state.copyWith(
        searching: false, clearLookup: true, clearError: true,
        clearNotice: true,
      );
      return;
    }
    state = state.copyWith(
      searching: true, clearLookup: true, clearError: true,
      clearNotice: true,
    );
    try {
      final found = await _transport.lookup(raw);
      if (!_authorized || epoch != _searchEpoch) return;
      state = state.copyWith(
        searching: false,
        lookup: found,
        lookupHandle: raw,
        notice: found == null ? 'No available contact for that handle.' : null,
        clearNotice: found != null,
      );
    } catch (error) {
      if (!_authorized || epoch != _searchEpoch) return;
      state = state.copyWith(
        searching: false, clearLookup: true, error: _errorText(error),
      );
    }
  }

  Future<void> _mutate(
    Future<String> Function() operation, {
    required String Function(String) notice,
    bool updateList = true,
  }) async {
    if (!_authorized || state.busy) return;
    // Invalidate every in-flight server read *before* dispatching the write:
    // a slower pre-revocation page, lookup or preferences read must never
    // publish old permissions after the user begins changing consent.
    ++_readEpoch;
    ++_searchEpoch;
    state = state.copyWith(
      busy: true, loading: false, loadingMore: false, searching: false,
      clearLookup: true, clearError: true, clearNotice: true,
    );
    try {
      final outcome = await operation();
      if (!_authorized) return;
      // The write is confirmed, but the prior list is no longer authoritative.
      // Clear it before the readback; a failed refresh must not resurrect a
      // removed contact or preserve an obsolete admission status.
      state = state.copyWith(
        busy: false, clearLookup: true, notice: notice(outcome),
        contacts: updateList ? const <HumanContact>[] : null,
        clearNextCursor: updateList,
      );
      if (updateList) await refresh();
    } catch (error) {
      if (!_authorized) return;
      // HTTP failure is not proof that a write did not commit. In particular,
      // a timeout may occur after the server accepted a revocation or consent
      // change. Discard potentially stale rights until a fresh user-initiated
      // read succeeds. The screen exposes Retry whenever an error is shown.
      state = state.copyWith(
        busy: false, loading: false, loadingMore: false,
        clearLookup: true, clearNextCursor: updateList,
        contacts: updateList ? const <HumanContact>[] : null,
        clearPreferences: !updateList,
        error: _errorText(error),
      );
    }
  }

  Future<void> request(String handle) => _mutate(
    () => _transport.request(handle),
    notice: (status) => switch (status) {
      'accepted' => 'Contact connection accepted.',
      'pending' => 'Contact request sent.',
      _ => 'No new request was created. Review the existing request.',
    },
  );

  Future<void> respond(String userId, {required bool accept, required String requestRevision}) => _mutate(
    () => _transport.respond(userId, accept: accept, requestRevision: requestRevision),
    notice: (status) => status == 'accepted'
        ? 'Contact request accepted.'
        : 'Contact request declined.',
  );

  Future<void> revoke(String userId) => _mutate(
    () async {
      await _transport.revoke(userId);
      return 'revoked';
    },
    notice: (_) => 'Contact permission revoked.',
  );

  Future<void> updatePolicy(HumanContactPolicy policy) => _mutate(
    () async {
      final result = await _transport.updatePreferences(policy: policy);
      if (_authorized) {
        state = state.copyWith(preferences: result);
      }
      return 'saved';
    },
    notice: (_) => 'Message request policy saved.',
    updateList: false,
  );

  Future<void> updateDiscoverable(bool discoverable) => _mutate(
    () async {
      final result = await _transport.updatePreferences(
        discoverableByHandle: discoverable,
      );
      if (_authorized) {
        state = state.copyWith(preferences: result);
      }
      return 'saved';
    },
    notice: (_) => 'Handle visibility saved.',
    updateList: false,
  );
}
