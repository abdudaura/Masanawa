import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'owner_access.dart';

final ownerAccessTransportProvider = Provider<OwnerAccessTransport>(
  (ref) => const UnavailableOwnerAccessTransport(),
);

class OwnerAccessUiState {
  const OwnerAccessUiState({
    this.quote,
    this.request,
    this.loading = false,
    this.error,
  });

  final OwnerAccessQuote? quote;
  final OwnerAccessRequest? request;
  final bool loading;
  final String? error;
}

class OwnerAccessController extends StateNotifier<OwnerAccessUiState> {
  OwnerAccessController(this._transport) : super(const OwnerAccessUiState());

  final OwnerAccessTransport _transport;

  Future<OwnerAccessQuote?> quote({
    required String characterId,
    required OwnerAccessModality modality,
    required int durationMinutes,
  }) async {
    state = const OwnerAccessUiState(loading: true);
    try {
      final value = await _transport.quote(
        characterId: characterId,
        modality: modality,
        durationMinutes: durationMinutes,
      );
      state = OwnerAccessUiState(quote: value);
      return value;
    } catch (_) {
      state = const OwnerAccessUiState(
        error: 'Could not get an owner-chat price right now.',
      );
      return null;
    }
  }

  Future<OwnerAccessRequest?> submit({
    required String characterId,
  }) async {
    final quote = state.quote;
    if (quote == null) return null;
    if (quote.quoteExpiresAt.isBefore(DateTime.now())) {
      state = OwnerAccessUiState(
        quote: quote,
        error: 'This request offer expired. Get a new one.',
      );
      return null;
    }
    state = OwnerAccessUiState(quote: quote, loading: true);
    try {
      final request = await _transport.request(
        characterId: characterId,
        quote: quote,
      );
      state = OwnerAccessUiState(quote: quote, request: request);
      return request;
    } catch (_) {
      state = OwnerAccessUiState(
        quote: quote,
        error: 'Could not send the request right now.',
      );
      return null;
    }
  }
}

final ownerAccessControllerProvider =
    StateNotifierProvider<OwnerAccessController, OwnerAccessUiState>(
  (ref) => OwnerAccessController(ref.watch(ownerAccessTransportProvider)),
);
