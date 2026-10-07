import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_ai_seat.dart';
import '../talks/talk_ai_seat_http_transport.dart';

final talkAiSeatTransportProvider = Provider<TalkAiSeatTransport>(
  (ref) => GatewayTalkAiSeatTransport(api: ref.watch(apiClientProvider)),
);

final talkAiSeatCatalogProvider =
    FutureProvider.family<List<TalkAiSeatCandidate>, String>(
  (ref, talkId) => ref.watch(talkAiSeatTransportProvider).loadCandidates(
        talkId: talkId,
      ),
);
