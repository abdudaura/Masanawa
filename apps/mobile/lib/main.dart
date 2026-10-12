import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'src/localization/masanawa_localization.dart';
import 'src/localization/locale_preference.dart';
import 'src/localization/locale_preference_scope.dart';
import 'src/core/mobile_push.dart';
import 'src/core/pending_deep_link.dart';
import 'src/core/shell_deep_link.dart';
import 'src/router/app_router.dart';
import 'src/state/session_state.dart';
import 'src/theme/masanawa_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: MasanawaApp()));
}

class MasanawaApp extends ConsumerStatefulWidget {
  const MasanawaApp({super.key});

  @override
  ConsumerState<MasanawaApp> createState() => _MasanawaAppState();
}

class _MasanawaAppState extends ConsumerState<MasanawaApp> {
  StreamSubscription<Uri>? _links;
  final _pendingLink = PendingDeepLink();
  bool _linkDrainScheduled = false;
  late final GoRouter _router;
  late final LocalePreferenceController _localePreference;

  @override
  void initState() {
    super.initState();
    _localePreference = LocalePreferenceController(
      SecureLocalePreferenceStore(),
    );
    unawaited(_localePreference.load());
    _links = MobilePushService.instance.deepLinks.listen(_openDeepLink);
    final initial = MobilePushService.instance.takeInitialDeepLink();
    if (initial != null) _pendingLink.offer(initial);
    _router = ref.read(appRouterProvider);
    _router.routeInformationProvider.addListener(_scheduleLinkDrain);
    _scheduleLinkDrain();

    // Push/Firebase/native-link setup is useful but not required to paint the
    // first usable frame. Starting it after first paint avoids competing with
    // router/theme/session startup on slower Android devices.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(MobilePushService.instance.initialize().catchError((_) {}));
    });
  }

  void _openDeepLink(Uri uri) {
    if (!mounted) return;
    _pendingLink.offer(uri);
    _scheduleLinkDrain();
  }

  void _scheduleLinkDrain() {
    if (!mounted || _linkDrainScheduled) return;
    _linkDrainScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _linkDrainScheduled = false;
      if (!mounted) return;
      final session = ref.read(sessionProvider);
      final router = ref.read(appRouterProvider);
      final uri = _pendingLink.take(
        ready:
            session is SessionSignedIn &&
            !session.user.isNewUser &&
            router.routeInformationProvider.value.uri.path != '/splash',
      );
      if (uri != null) {
        final route = shellDeepLinkRoute(uri);
        if (route != null &&
            canOpenIncomingCallRoute(
              currentPath: router.routeInformationProvider.value.uri.path,
              targetPath: route,
              hasActiveCall:
                  router.routerDelegate.navigatorKey.currentState?.canPop() ??
                  false,
            )) {
          router.go(route);
        }
      }
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  @override
  void dispose() {
    _links?.cancel();
    _localePreference.dispose();
    _router.routeInformationProvider.removeListener(_scheduleLinkDrain);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (previous is SessionSignedIn && next is SessionSignedOut) {
        _pendingLink.clear();
      }
      _scheduleLinkDrain();
    });
    final router = ref.watch(appRouterProvider);
    return ListenableBuilder(
      listenable: _localePreference,
      builder: (context, _) => LocalePreferenceScope(
        controller: _localePreference,
        child: MaterialApp.router(
          title: 'Masanawa',
          debugShowCheckedModeBanner: false,
          theme: buildMasanawaTheme(brightness: Brightness.light),
          // R01: never follow the device into an unrequested dark theme.
          themeMode: ThemeMode.light,
          locale: _localePreference.localeOverride,
          supportedLocales: MasanawaLocalization.supportedLocales,
          localizationsDelegates: MasanawaLocalization.delegates,
          localeListResolutionCallback: (deviceLocales, supportedLocales) =>
              MasanawaLocalization.resolvePreferred(
                deviceLocales,
                supportedLocales,
              ),
          routerConfig: router,
        ),
      ),
    );
  }
}
