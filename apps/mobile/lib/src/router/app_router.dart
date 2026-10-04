import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../screens/chat/ai_chat_screen.dart';
import '../screens/chat/chat_list_screen.dart';
import '../screens/chat/masana_list_screen.dart';
import '../screens/onboarding/name_screen.dart';
import '../screens/onboarding/otp_screen.dart';
import '../screens/onboarding/phone_login_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/settings/clone_setup_screen.dart';
import '../screens/splash/splash_screen.dart';
import '../state/session_state.dart';

/// Stripped router — auth (splash → phone → OTP → name), the chat list, one
/// thread per configured Character, the agent list, and settings. Nothing else.
///
/// Auth rule: OTP must prove ownership. `/name` opens only for first signup
/// (`SessionNameRequired` or signed-in + `isNewUser`). While the session is
/// still restoring/sending/verifying, no redirect fires so splash never races
/// to login on a slow device.
final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final path = state.matchedLocation;

      if (path == '/splash') return null;
      if (path == '/chat') return '/chats';

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
        return user.isNewUser ? '/name' : '/chats';
      }

      // /name is first-signup only.
      if (path == '/name') {
        if (session is SessionNameRequired) return null;
        if (isSignedIn) {
          final user = (session as SessionSignedIn).user;
          return user.isNewUser ? null : '/chats';
        }
        return '/phone-login';
      }

      // Signed-out users can only be in auth.
      final protected = path == '/chats' ||
          path.startsWith('/chat/') ||
          (path == '/agents' || path == '/masana') ||
          path == '/settings' ||
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
      GoRoute(path: '/chats', builder: (_, _) => const ChatListScreen()),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) => AiChatScreen(
          characterId: state.pathParameters['id']!,
        ),
      ),
      // Backwards-compat: the old single chat now lands on the list.
      GoRoute(path: '/home', builder: (_, _) => const ChatListScreen()),
      GoRoute(path: '/agents', builder: (_, _) => const AgentListScreen()),
      GoRoute(path: '/masana', redirect: (_, __) => '/agents'),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(path: '/clone', builder: (_, _) => const CloneSetupScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const SettingsScreen()),
    ],
  );

  ref.listen(isSignedInProvider, (_, _) => router.refresh());
  return router;
});
