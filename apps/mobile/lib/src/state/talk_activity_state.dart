import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../activity/talk_activity.dart';
import '../activity/talk_activity_http_transport.dart';
import '../core/providers.dart';
import 'session_state.dart';

final talkActivityTransportProvider = Provider<TalkActivityTransport>(
  (ref) => GatewayTalkActivityTransport(api: ref.watch(apiClientProvider)),
);

final talkActivityProvider =
    FutureProvider.family<List<TalkActivityItem>, TalkActivityFilter>(
  (ref, filter) {
    // ApiClient is reused while its bearer token changes in-place. Explicitly
    // watch session identity so Riverpod disposes the prior account's pending
    // Activity response/cache instead of rendering it under the next account.
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return Future.value(const <TalkActivityItem>[]);
    }
    return ref.watch(talkActivityTransportProvider).load(filter: filter);
  },
);
