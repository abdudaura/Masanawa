import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers.dart';
import '../talks/talk_direct_twin.dart';
import '../talks/talk_direct_twin_http_transport.dart';

final directTwinTransportProvider = Provider<DirectTwinTransport>(
  (ref) => GatewayDirectTwinTransport(api: ref.watch(apiClientProvider)),
);

final myDirectTwinSeatsProvider = FutureProvider.family<List<DirectTwinSeat>, String>(
  (ref, talkId) => ref.watch(directTwinTransportProvider).mine(talkId),
);
