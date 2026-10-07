import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_host_controls.dart';
import '../talks/talk_host_controls_http_transport.dart';

final talkHostControlsTransportProvider = Provider<TalkHostControlsTransport>(
  (ref) => GatewayTalkHostControlsTransport(api: ref.watch(apiClientProvider)),
);

final talkHostControlsProvider =
    FutureProvider.family<TalkHostControlsView, String>(
  (ref, talkId) => ref.watch(talkHostControlsTransportProvider).load(talkId),
);
