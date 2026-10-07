import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../library/talk_library.dart';
import '../library/talk_library_http_transport.dart';
import '../talks/talk_models.dart';

final talkLibraryTransportProvider = Provider<TalkLibraryTransport>(
  (ref) => GatewayTalkLibraryTransport(api: ref.watch(apiClientProvider)),
);

final myTalksProvider = FutureProvider<MyTalksView>(
  (ref) => ref.watch(talkLibraryTransportProvider).loadMyTalks(),
);

final savedTalksProvider = FutureProvider<List<TalkDiscoveryItem>>(
  (ref) => ref.watch(talkLibraryTransportProvider).loadSavedTalks(),
);


final talkSavedProvider = FutureProvider.family<bool, String>(
  (ref, talkId) =>
      ref.watch(talkLibraryTransportProvider).isSaved(talkId),
);
