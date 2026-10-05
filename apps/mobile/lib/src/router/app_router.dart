import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../screens/chat/ai_chat_screen.dart';
import '../screens/billing/billing_screen.dart';
import '../screens/onboarding/name_screen.dart';
import '../screens/onboarding/otp_screen.dart';
import '../screens/onboarding/phone_login_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/twin/twin_home_shell.dart';
import '../finance/crypto_wallet_screen.dart';
import '../screens/settings/clone_setup_screen.dart';
import '../screens/splash/splash_screen.dart';
import '../state/session_state.dart';

/// Production router: auth, the Twin-first consumer shell, direct chat and
/// focused capability routes. Runtime internals stay behind the four root tabs.
///
/// Auth rule: OTP proves ownership. A first signup may pause at `/name`
/// after successful OTP proof but before the session is issued. All Agent
/// surfaces require the resulting signed-in platform session.
final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final path = state.matchedLocation;

      if (path == '/splash') return null;
      if (path == '/chat') return '/home';
      if (path == '/chats' || path == '/agents' || path == '/masana') {
        return '/home';
      }

      final session = ref.read(sessionProvider);
      final isSignedIn = session is SessionSignedIn;

      // Still loading (restore / OTP send / verify) — hold position.
      if (session is SessionRestoring ||
          session is SessionSendingOtp ||
          session is SessionVerifying) {
        return null;
      }

      // Signed-in users never sit on login/OTP.
      if (isSignedIn && (path == '/phone-login' || path == '/otp')) {
        final user = (session as SessionSignedIn).user;
        return user.isNewUser ? '/name' : '/home';
      }

      // /name is first-signup only.
      if (path == '/name') {
        if (session is SessionNameRequired) return null;
        if (isSignedIn) {
          final user = (session as SessionSignedIn).user;
          return user.isNewUser ? null : '/home';
        }
        return '/phone-login';
      }

      // Signed-out users can only be in auth.
      final protected = path == '/home' ||
          path == '/chats' ||
          path.startsWith('/chat/') ||
          path == '/agents' ||
          path == '/masana' ||
          path == '/settings' ||
          path == '/billing' ||
          path == '/crypto' ||
          path == '/clone' ||
          path == '/profile';
      if (!isSignedIn && protected) return '/phone-login';

      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(
          path: '/phone-login', builder: (_, _) => const PhoneLoginScreen()),
      GoRoute(path: '/otp', builder: (_, _) => const OtpScreen()),
      GoRoute(path: '/name', builder: (_, _) => const NameScreen()),
      GoRoute(path: '/home', builder: (_, _) => const TwinHomeShell()),
      GoRoute(path: '/chats', redirect: (_, __) => '/home'),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) => AiChatScreen(
          characterId: state.pathParameters['id']!,
        ),
      ),
      // Backwards-compatible legacy entry points now converge on the Twin shell.
      GoRoute(path: '/agents', redirect: (_, __) => '/home'),
      GoRoute(path: '/masana', redirect: (_, __) => '/home'),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(path: '/billing', builder: (_, _) => const BillingScreen()),
      GoRoute(path: '/crypto', builder: (_, _) => const CryptoWalletScreen()),
      GoRoute(path: '/clone', builder: (_, _) => const CloneSetupScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const SettingsScreen()),
    ],
  );

  ref.listen(isSignedInProvider, (_, _) => router.refresh());
  return router;
});
