import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../activity/talk_activity.dart';
import '../activity/talk_activity_http_transport.dart';
import '../core/providers.dart';

final talkActivityTransportProvider = Provider<TalkActivityTransport>(
  (ref) => GatewayTalkActivityTransport(api: ref.watch(apiClientProvider)),
);

final talkActivityProvider =
    FutureProvider.family<List<TalkActivityItem>, TalkActivityFilter>(
  (ref, filter) => ref.watch(talkActivityTransportProvider).load(
        filter: filter,
      ),
);
