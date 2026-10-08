import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_gift.dart';
import '../talks/talk_gift_http_transport.dart';
import '../talks/talk_gift_pending_store.dart';
import 'session_state.dart';

// Encrypted request state is a singleton separate from the account's
// authentication record. Its keys are scoped to the signed-in user ID.
final talkGiftPendingStoreProvider = Provider<TalkGiftPendingStore>(
  (_) => SecureTalkGiftPendingStore(),
);

final talkGiftTransportProvider = Provider<TalkGiftTransport>((ref) {
  final session = ref.watch(sessionProvider);
  final ownerId = session is SessionSignedIn ? session.user.id : '';
  return GatewayTalkGiftTransport(
    api: ref.watch(apiClientProvider),
    pendingStore: ref.watch(talkGiftPendingStoreProvider),
    pendingOwnerId: ownerId,
    activeUserId: () {
      final current = ref.read(sessionProvider);
      return current is SessionSignedIn ? current.user.id : null;
    },
  );
});
