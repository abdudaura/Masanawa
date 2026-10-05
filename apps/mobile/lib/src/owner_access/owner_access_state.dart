import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import 'owner_access.dart';
import 'owner_access_http_transport.dart';

final ownerAccessTransportProvider = Provider<OwnerAccessTransport>(
  (ref) => GatewayOwnerAccessTransport(api: ref.watch(apiClientProvider)),
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
        quoteId: quote.requestId,
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

  Future<OwnerAccessRequest?> latest({
    required String characterId,
  }) async {
    state = OwnerAccessUiState(
      quote: state.quote,
      request: state.request,
      loading: true,
    );
    try {
      final request = await _transport.latest(characterId: characterId);
      state = OwnerAccessUiState(quote: state.quote, request: request);
      return request;
    } catch (_) {
      state = OwnerAccessUiState(
        quote: state.quote,
        request: state.request,
        error: 'Could not load your latest owner request right now.',
      );
      return null;
    }
  }

  Future<OwnerAccessRequest?> read({
    required String characterId,
    required String requestId,
  }) async {
    state = OwnerAccessUiState(
      quote: state.quote,
      request: state.request,
      loading: true,
    );
    try {
      final request = await _transport.read(
        characterId: characterId,
        requestId: requestId,
      );
      state = OwnerAccessUiState(quote: state.quote, request: request);
      return request;
    } catch (_) {
      state = OwnerAccessUiState(
        quote: state.quote,
        error: 'Could not load this owner request right now.',
      );
      return null;
    }
  }

  Future<OwnerAccessRequest?> act({
    required String characterId,
    required String requestId,
    required String action,
    DateTime? scheduledFor,
  }) async {
    state = OwnerAccessUiState(
      quote: state.quote,
      request: state.request,
      loading: true,
    );
    try {
      final request = await _transport.act(
        characterId: characterId,
        requestId: requestId,
        action: action,
        scheduledFor: scheduledFor,
      );
      state = OwnerAccessUiState(quote: state.quote, request: request);
      return request;
    } catch (_) {
      state = OwnerAccessUiState(
        quote: state.quote,
        request: state.request,
        error: 'Could not update this owner request right now.',
      );
      return null;
    }
  }
}

final ownerAccessControllerProvider =
    StateNotifierProvider<OwnerAccessController, OwnerAccessUiState>(
  (ref) => OwnerAccessController(ref.watch(ownerAccessTransportProvider)),
);


final ownerAccessOfferingTransportProvider =
    Provider<GatewayOwnerAccessOfferingTransport>(
  (ref) => GatewayOwnerAccessOfferingTransport(
    api: ref.watch(apiClientProvider),
  ),
);

class OwnerAccessOfferingController
    extends AsyncNotifier<OwnerAccessOffering?> {
  @override
  Future<OwnerAccessOffering?> build() async {
    if (!ref.watch(isSignedInProvider)) return null;
    return ref.watch(ownerAccessOfferingTransportProvider).read();
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(ownerAccessOfferingTransportProvider).read(),
    );
  }

  Future<OwnerAccessOffering?> save(OwnerAccessOffering offering) async {
    if (!ref.read(isSignedInProvider)) return null;
    state = const AsyncLoading();
    try {
      final saved =
          await ref.read(ownerAccessOfferingTransportProvider).update(offering);
      state = AsyncData(saved);
      return saved;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      return null;
    }
  }

  Future<OwnerAccessOffering?> setEnabled(bool enabled) async {
    final current = state.valueOrNull;
    if (current == null) return null;
    return save(current.copyWith(enabled: enabled));
  }

  Future<OwnerAccessOffering?> setPriceCreditsPerMinute(int value) async {
    final current = state.valueOrNull;
    if (current == null || value < 1) return null;
    return save(current.copyWith(priceCreditsPerMinute: value));
  }

  Future<OwnerAccessOffering?> setDurations(List<int> values) async {
    final current = state.valueOrNull;
    if (current == null || values.isEmpty) return null;
    return save(current.copyWith(
      durationOptionsMinutes: List.unmodifiable(values),
    ));
  }
}

final ownerAccessOfferingProvider =
    AsyncNotifierProvider<OwnerAccessOfferingController, OwnerAccessOffering?>(
  OwnerAccessOfferingController.new,
);
