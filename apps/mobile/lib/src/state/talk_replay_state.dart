import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_replay.dart';
import '../talks/talk_replay_http_transport.dart';

final talkReplayTransportProvider = Provider<TalkReplayTransport>(
  (ref) => GatewayTalkReplayTransport(api: ref.watch(apiClientProvider)),
);

final talkReplayProvider = FutureProvider.family<TalkReplayView, String>(
  (ref, talkId) => ref.watch(talkReplayTransportProvider).load(talkId),
);
