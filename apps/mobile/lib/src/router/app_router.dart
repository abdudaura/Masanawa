import '../calls/incoming_call_coordinator.dart';
import '../calls/incoming_call_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../finance/crypto_wallet_screen.dart';
import '../screens/activity/activity_screen.dart';
import '../screens/billing/billing_screen.dart';
import '../screens/chat/ai_chat_screen.dart';
import '../screens/onboarding/name_screen.dart';
import '../screens/onboarding/otp_screen.dart';
import '../screens/onboarding/password_screen.dart';
import '../screens/onboarding/phone_login_screen.dart';
import '../screens/profile/edit_profile_screen.dart';
import '../screens/profile/person_profile_screen.dart';
import '../screens/profile/persona_profile_screen.dart';
import '../screens/search/talk_search_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/splash/splash_screen.dart';
import '../screens/talks/create_talk_screen.dart';
import '../screens/talks/talk_screen.dart';
import '../screens/chat/masana_list_screen.dart';
import '../screens/twin/shell_tab.dart';
import '../shell/five_tab_shell.dart';
import '../screens/wallet/wallet_screen.dart';
import '../state/session_state.dart';
import '../talks/talk_models.dart';

/// The five canonical root destinations. These are navigation indices only,
/// not a pricing, identity or task-authority contract.
int shellRootTabIndex(String? tab) =>
    MasanawaRootTab.fromQuery(tab).index;

/// Retired shell links land on their closest current tab.
String? legacyShellDestination(String? tab) => switch (tab) {
      'create' => '/talk/create',
      'activity' => '/activity',
      'agents' => '/home?tab=chats',
      'wallet' => '/home?tab=wallet',
      'talk' => '/home?tab=status',
      'home' => '/home?tab=chats',
      _ => null,
    };

/// Production router for the audio-first product.
///
/// Canonical root shell: Chats · Rooms · Talks · Gwani · Wallet (Talks
/// default). The legacy Home · Agents · Wallet · Talk entries below stay
/// valid as redirects until the shell migration unit removes them.
final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final path = state.matchedLocation;

      if (path == '/splash') return null;
      if (path == '/chat' || path == '/chats') return '/home?tab=chats';
      if (path == '/agents') return '/home?tab=chats';

      final session = ref.read(sessionProvider);
      final isSignedIn = session is SessionSignedIn;

      if (session is SessionRestoring ||
          session is SessionSendingOtp ||
          session is SessionVerifying) {
        return null;
      }

      if (isSignedIn && (path == '/phone-login' || path == '/otp')) {
        final user = (session as SessionSignedIn).user;
        return user.isNewUser ? '/name' : '/home';
      }

      if (path == '/name') {
        if (session is SessionNameRequired) return null;
        if (isSignedIn) {
          final user = (session as SessionSignedIn).user;
          return user.isNewUser ? null : '/home';
        }
        return '/phone-login';
      }

      final protected = path.startsWith('/calls/incoming/') ||
          path == '/home' ||
          path == '/activity' ||
          path == '/search' ||
          path == '/chats' ||
          path.startsWith('/chat/') ||
          path.startsWith('/talk/') ||
          path.startsWith('/u/') ||
          path.startsWith('/persona/') ||
          path == '/agents' ||
          path == '/masana' ||
          path == '/settings' ||
          path == '/wallet' ||
          path == '/billing' ||
          path == '/crypto' ||
          path == '/profile';
      if (!isSignedIn && protected) return '/phone-login';

      // Retired shell deep links land on their closest current tab.
      if (path == '/home') {
        final oldDestination = legacyShellDestination(
          state.uri.queryParameters['tab']);
        if (oldDestination != null) return oldDestination;
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(
        path: '/phone-login',
        builder: (_, _) => const PhoneLoginScreen(),
      ),
      GoRoute(path: '/otp', builder: (_, _) => const OtpScreen()),
      GoRoute(
        path: '/password',
        builder: (_, state) => PasswordScreen(
          phone: state.uri.queryParameters['phone'] ?? '',
          setup: state.uri.queryParameters['setup'] == '1',
        ),
      ),
      GoRoute(path: '/name', builder: (_, _) => const NameScreen()),
      GoRoute(
        path: '/home',
        builder: (_, state) {
          final index = shellRootTabIndex(
            state.uri.queryParameters['tab']);
          return IncomingCallCoordinator(child: FiveTabShell(initialIndex: index));
        },
      ),
      GoRoute(
        path: '/activity',
        builder: (context, _) => ActivityScreen(
          onOpenTalk: (id) => context.push('/talk/' + Uri.encodeComponent(id)),
          onOpenProfile: (handle) => context.push(
            '/u/' + Uri.encodeComponent(handle)),
        ),
      ),
      GoRoute(
        path: '/search',
        builder: (context, state) => TalkSearchScreen(
          initialQuery: state.uri.queryParameters['q'],
          onOpenTalk: (talk) => context.push(
            '/talk/' + Uri.encodeComponent(talk.id),
            extra: talk,
          ),
          onOpenPerson: (handle) => context.push(
            '/u/' + Uri.encodeComponent(handle),
          ),
          onOpenPersona: (publicId) => context.push(
            '/persona/' + Uri.encodeComponent(publicId),
          ),
        ),
      ),
      GoRoute(
        path: '/talk/create',
        builder: (context, _) => CreateTalkScreen(
          onCreated: (talk) => context.go(
            '/talk/' + Uri.encodeComponent(talk.id) + '?host=1',
            extra: talk,
          ),
        ),
      ),
      GoRoute(
        path: '/talk/:id',
        builder: (context, state) {
          final extra = state.extra;
          final initialTalk = extra is TalkDiscoveryItem ? extra : null;
          return TalkScreen(
            talkId: state.pathParameters['id']!,
            initialTalk: initialTalk,
            isHost: state.uri.queryParameters['host'] == '1' ||
                initialTalk?.viewerIsHost == true,
          );
        },
      ),
      GoRoute(
        path: '/u/:handle',
        builder: (context, state) => PersonProfileScreen(
          handle: state.pathParameters['handle']!,
          onOpenTalk: (talkId) => context.push('/talk/' + Uri.encodeComponent(talkId)),
          onOpenTwin: (publicId) => context.push('/persona/' + Uri.encodeComponent(publicId)),
        ),
      ),
      GoRoute(
        path: '/persona/:publicId',
        builder: (context, state) => PersonaProfileScreen(
          publicId: state.pathParameters['publicId']!,
          onOpenTalk: (talkId) => context.push('/talk/' + Uri.encodeComponent(talkId)),
          onOpenOwner: (handle) => context.push('/u/' + Uri.encodeComponent(handle)),
        ),
      ),
      GoRoute(
        path: '/wallet',
        builder: (context, _) => WalletScreen(
          onBuyBills: () => context.push('/billing'),
          onOpenCrypto: () => context.push('/crypto'),
        ),
      ),
      GoRoute(
        path: '/calls/incoming/:callId',
        builder: (context, state) => IncomingCallScreen(
          callId: state.pathParameters['callId']!,
        ),
      ),
      GoRoute(path: '/chats', redirect: (_, __) => '/home?tab=chats'),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) {
          final entry = switch (state.uri.queryParameters['entry']) {
            'study' => AiChatEntryMode.study,
            'voice-note' => AiChatEntryMode.liveTalk,
            'live-talk' => AiChatEntryMode.liveTalk,
            'live-voice' => AiChatEntryMode.liveVoice,
            'cafe' => AiChatEntryMode.cafe,
            _ => AiChatEntryMode.chat,
          };
          return AiChatScreen(
            characterId: state.pathParameters['id']!,
            entryMode: entry,
            initialPrompt: state.uri.queryParameters['prompt'],
          );
        },
      ),
      GoRoute(
        path: '/agents', redirect: (_, __) => '/home?tab=chats'),
      GoRoute(path: '/masana', builder: (_, _) => const MasanaListScreen()),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(
        path: '/billing',
        builder: (_, state) => BillingScreen(
          initialService: state.uri.queryParameters['service'],
        ),
      ),
      GoRoute(path: '/crypto', builder: (_, _) => const CryptoWalletScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const EditProfileScreen()),
    ],
  );

  ref.listen(isSignedInProvider, (_, _) => router.refresh());
  return router;
});
