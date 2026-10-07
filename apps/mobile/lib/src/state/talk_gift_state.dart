import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_gift.dart';
import '../talks/talk_gift_http_transport.dart';

final talkGiftTransportProvider = Provider<TalkGiftTransport>(
  (ref) => GatewayTalkGiftTransport(api: ref.watch(apiClientProvider)),
);
