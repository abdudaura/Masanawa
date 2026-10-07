import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_http_transport.dart';
import '../talks/talk_models.dart';

final talkTransportProvider = Provider<TalkTransport>(
  (ref) => GatewayTalkTransport(api: ref.watch(apiClientProvider)),
);

final talkFeedProvider =
    FutureProvider.family<List<TalkDiscoveryItem>, TalkFeedKind>(
  (ref, feed) => ref.watch(talkTransportProvider).loadFeed(feed),
);

final talkDetailProvider = FutureProvider.family<TalkDetail, String>(
  (ref, talkId) => ref.watch(talkTransportProvider).loadTalk(talkId),
);
