import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers.dart';
import '../talks/talk_safety.dart';
import '../talks/talk_safety_http_transport.dart';

final talkSafetyTransportProvider = Provider<TalkSafetyTransport>(
  (ref) => GatewayTalkSafetyTransport(api: ref.watch(apiClientProvider)),
);

final talkSafetyPreferenceProvider = FutureProvider.family<TalkSafetyPreference, String>(
  (ref, handle) => ref.watch(talkSafetyTransportProvider).loadPreference(handle),
);
