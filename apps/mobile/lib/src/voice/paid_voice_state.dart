import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'paid_voice.dart';

final paidVoiceTransportProvider = Provider<PaidVoiceTransport>(
  (ref) => const UnavailablePaidVoiceTransport(),
);

class PaidVoiceState {
  const PaidVoiceState({
    this.quote,
    this.admission,
    this.loading = false,
    this.error,
  });

  final PaidVoiceQuote? quote;
  final PaidVoiceAdmission? admission;
  final bool loading;
  final String? error;
}

class PaidVoiceController extends StateNotifier<PaidVoiceState> {
  PaidVoiceController(this._transport) : super(const PaidVoiceState());

  final PaidVoiceTransport _transport;

  Future<PaidVoiceQuote?> quote({
    required String characterId,
    int expectedSeconds = 300,
  }) async {
    state = const PaidVoiceState(loading: true);
    try {
      final value = await _transport.quote(
        characterId: characterId,
        expectedSeconds: expectedSeconds,
      );
      state = PaidVoiceState(quote: value);
      return value;
    } catch (_) {
      state = const PaidVoiceState(
        error: 'Could not get a voice price right now.',
      );
      return null;
    }
  }

  Future<PaidVoiceAdmission?> accept({
    required String characterId,
  }) async {
    final currentQuote = state.quote;
    if (currentQuote == null) return null;
    if (currentQuote.quoteExpiresAt.isBefore(DateTime.now())) {
      state = PaidVoiceState(
        quote: currentQuote,
        error: 'This voice offer expired. Get a new one.',
      );
      return null;
    }
    state = PaidVoiceState(quote: currentQuote, loading: true);
    try {
      final admission = await _transport.start(
        characterId: characterId,
        quoteId: currentQuote.quoteId,
      );
      state = PaidVoiceState(quote: currentQuote, admission: admission);
      return admission;
    } catch (_) {
      state = PaidVoiceState(
        quote: currentQuote,
        error: 'Could not start voice right now.',
      );
      return null;
    }
  }
}

final paidVoiceControllerProvider =
    StateNotifierProvider<PaidVoiceController, PaidVoiceState>(
  (ref) => PaidVoiceController(ref.watch(paidVoiceTransportProvider)),
);
