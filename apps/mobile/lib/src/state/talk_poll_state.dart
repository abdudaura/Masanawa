import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_polls.dart';
import '../talks/talk_polls_http_transport.dart';

final talkPollTransportProvider = Provider<TalkPollTransport>(
  (ref) => GatewayTalkPollTransport(api: ref.watch(apiClientProvider)),
);

final talkPollProvider = FutureProvider.family<TalkPoll?, String>(
  (ref, talkId) => ref.watch(talkPollTransportProvider).load(talkId),
);
