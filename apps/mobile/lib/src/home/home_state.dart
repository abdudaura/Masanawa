import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/my_twin_state.dart';
import '../state/session_state.dart';
import 'home_models.dart';

class HomeController extends AsyncNotifier<HomeSnapshot> {
  @override
  Future<HomeSnapshot> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    ref.watch(apiClientProvider);
    ref.watch(myTwinProvider);
    if (!signedIn) {
      return const HomeSnapshot(assistants: [], rooms: []);
    }
    return _load();
  }

  Future<HomeSnapshot> _load() async {
    final client = ref.read(apiClientProvider);
    final response = await client.dio.get<Map<String, dynamic>>('/v1/home');
    final data = response.data;
    if (data == null) {
      throw StateError('Home projection is unavailable');
    }

    final snapshot = HomeSnapshot.fromJson(data);
    final twin = await ref.read(myTwinProvider.future);
    return snapshot.withTwin(
      HomeTwinCardModel(
        title: 'My Twin',
        subtitle: twin != null && twin.hasTwin
            ? 'Teach, manage and share your Twin'
            : 'Create your personal AI Twin',
        hasTwin: twin != null && twin.hasTwin,
        characterId: twin?.characterId,
        publicUrl: twin?.publicUrl,
      ),
    );
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }
}

final homeProvider = AsyncNotifierProvider<HomeController, HomeSnapshot>(
  HomeController.new,
);
