import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/router/app_router.dart';
import 'src/theme/unigeria_theme.dart';

/// UNigeria AI app entry. ProviderScope owns the session state;
/// MaterialApp.router drives the splash→auth→chat flow.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: UnigeriaApp()));
}

class UnigeriaApp extends ConsumerWidget {
  const UnigeriaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Masanawa',
      debugShowCheckedModeBanner: false,
      theme: buildUnigeriaTheme(brightness: Brightness.light),
      darkTheme: buildUnigeriaTheme(brightness: Brightness.dark),
      // Follow the phone setting so the built dark tokens actually render.
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
