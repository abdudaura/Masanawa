import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_participation.dart';
import '../talks/talk_participation_http_transport.dart';

final talkParticipationTransportProvider = Provider<TalkParticipationTransport>(
  (ref) => GatewayTalkParticipationTransport(api: ref.watch(apiClientProvider)),
);

final talkParticipationProvider =
    FutureProvider.family<TalkParticipationState, String>(
  (ref, talkId) => ref.watch(talkParticipationTransportProvider).load(talkId),
);
