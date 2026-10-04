import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/core/mobile_push.dart';
import 'src/router/app_router.dart';
import 'src/theme/masanawa_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await MobilePushService.instance.initialize().catchError((_) {});
  runApp(const ProviderScope(child: MasanawaApp()));
}

class MasanawaApp extends ConsumerStatefulWidget {
  const MasanawaApp({super.key});

  @override
  ConsumerState<MasanawaApp> createState() => _MasanawaAppState();
}

class _MasanawaAppState extends ConsumerState<MasanawaApp> {
  StreamSubscription<Uri>? _links;

  @override
  void initState() {
    super.initState();
    _links = MobilePushService.instance.deepLinks.listen(_openDeepLink);
  }

  void _openDeepLink(Uri uri) {
    if (!mounted) return;
    final router = ref.read(appRouterProvider);
    String? characterId;
    if (uri.host == 'chat' && uri.pathSegments.isNotEmpty) {
      characterId = Uri.decodeComponent(uri.pathSegments.first);
    } else {
      characterId = uri.queryParameters['characterId'];
    }
    if (characterId != null && characterId.startsWith('character_')) {
      router.go('/chat/${Uri.encodeComponent(characterId)}');
    } else {
      router.go('/chats');
    }
  }

  @override
  void dispose() {
    _links?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Masanawa',
      debugShowCheckedModeBanner: false,
      theme: buildMasanawaTheme(brightness: Brightness.light),
      darkTheme: buildMasanawaTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
