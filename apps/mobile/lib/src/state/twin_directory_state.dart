import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/twin_directory.dart';
import 'session_state.dart';

final twinDirectoryTransportProvider = Provider<TwinDirectoryTransport>(
  (ref) => const UnavailableTwinDirectoryTransport(),
);

class TwinDirectoryQuery {
  const TwinDirectoryQuery({this.text = ''});
  final String text;
}

final twinDirectoryQueryProvider = StateProvider<TwinDirectoryQuery>(
  (ref) => const TwinDirectoryQuery(),
);

class TwinDirectoryController
    extends AsyncNotifier<List<TwinDirectoryEntry>> {
  @override
  Future<List<TwinDirectoryEntry>> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    final query = ref.watch(twinDirectoryQueryProvider).text;
    final transport = ref.watch(twinDirectoryTransportProvider);
    if (!signedIn) return const [];
    return transport.search(query: query);
  }

  Future<void> search(String value) async {
    final query = value.trim();
    if (query.length > 80) return;
    ref.read(twinDirectoryQueryProvider.notifier).state =
        TwinDirectoryQuery(text: query);
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    final query = ref.read(twinDirectoryQueryProvider).text;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(twinDirectoryTransportProvider).search(query: query),
    );
  }

  Future<TwinDirectoryEntry?> resolveShare(String publicId) {
    return ref.read(twinDirectoryTransportProvider).resolvePublicId(publicId);
  }
}

final twinDirectoryProvider =
    AsyncNotifierProvider<TwinDirectoryController, List<TwinDirectoryEntry>>(
  TwinDirectoryController.new,
);
