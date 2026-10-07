import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../search/talk_search.dart';
import '../search/talk_search_http_transport.dart';

final talkSearchTransportProvider = Provider<TalkSearchTransport>(
  (ref) => GatewayTalkSearchTransport(api: ref.watch(apiClientProvider)),
);
