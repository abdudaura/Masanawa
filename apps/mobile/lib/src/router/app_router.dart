import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../finance/crypto_wallet_screen.dart';
import '../screens/activity/activity_screen.dart';
import '../screens/billing/billing_screen.dart';
import '../screens/chat/ai_chat_screen.dart';
import '../screens/chat/masana_list_screen.dart';
import '../screens/onboarding/name_screen.dart';
import '../screens/onboarding/otp_screen.dart';
import '../screens/onboarding/phone_login_screen.dart';
import '../screens/owner_access/owner_access_session_screen.dart';
import '../screens/profile/edit_profile_screen.dart';
import '../screens/profile/person_profile_screen.dart';
import '../screens/profile/persona_profile_screen.dart';
import '../screens/settings/clone_setup_screen.dart';
import '../screens/search/talk_search_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/splash/splash_screen.dart';
import '../screens/talks/create_talk_screen.dart';
import '../screens/talks/talk_screen.dart';
import '../screens/twin/twin_home_shell.dart';
import '../screens/twin/shell_tab.dart';
import '../screens/you/my_talks_screen.dart';
import '../screens/you/you_screen.dart';
import '../screens/you/saved_talks_screen.dart';
import '../screens/wallet/wallet_screen.dart';
import '../state/session_state.dart';
import '../state/twin_directory_state.dart';
import '../talks/talk_models.dart';

/// The confirmed five root destinations. These are navigation indices only,
/// not a pricing, identity or task-authority contract.
int shellRootTabIndex(String? tab) =>
    MasanawaRootTab.fromQuery(tab).index;

/// Old shell links must not be reinterpreted as different current tabs.
String? legacyShellDestination(String? tab) => switch (tab) {
      'create' => '/talk/create',
      'activity' => '/activity',
      'you' => '/you',
      'agents' || 'masana' => '/agents',
      _ => null,
    };

/// Production router for the human-hosted Talk product.
///
/// Root shell: Chats · Rooms · Talks · Gwani · Wallet. Talks is default.
/// Historical live Talk and AI routes remain separately typed resources.
final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final path = state.matchedLocation;

      if (path == '/splash') return null;
      if (path == '/chat') return '/home?tab=gwani';
      if (path == '/chats' || path == '/messages') return '/home?tab=chats';
      if (path == '/rooms') return '/home?tab=rooms';
      if (path == '/talks') return '/home';
      if (path == '/gwani' || path == '/assistant') return '/home?tab=gwani';

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

      final protected = path == '/home' ||
          path == '/activity' ||
          path == '/you' ||
          path == '/search' ||
          path == '/chats' ||
          path.startsWith('/chat/') ||
          path.startsWith('/talk/') ||
          path.startsWith('/u/') ||
          path.startsWith('/persona/') ||
          path.startsWith('/twin/') ||
          path.startsWith('/owner-session/') ||
          path == '/agents' ||
          path == '/masana' ||
          path == '/settings' ||
          path == '/my-twin' ||
          path == '/my-talks' ||
          path == '/saved-talks' ||
          path == '/wallet' ||
          path == '/billing' ||
          path == '/crypto' ||
          path == '/clone' ||
          path == '/profile';
      if (!isSignedIn && protected) return '/phone-login';

      // Legacy shell deep links must retain their previous action.
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
      GoRoute(path: '/name', builder: (_, _) => const NameScreen()),
      GoRoute(
        path: '/home',
        builder: (_, state) {
          final index = shellRootTabIndex(
            state.uri.queryParameters['tab']);
          return TwinHomeShell(initialIndex: index);
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
        path: '/you',
        builder: (context, _) => YouScreen(
          onOpenProfile: () => context.push('/profile'),
          onOpenMyTalks: () => context.push('/my-talks'),
          onOpenMyTwin: () => context.push('/my-twin'),
          onOpenSaved: () => context.push('/saved-talks'),
          onOpenWallet: () => context.push('/wallet'),
          onOpenBills: () => context.push('/billing'),
          onOpenCrypto: () => context.push('/crypto'),
          onOpenSettings: () => context.push('/settings'),
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
        path: '/my-talks',
        builder: (context, _) => MyTalksScreen(
          onOpenTalk: (talk) => context.push(
            '/talk/' + Uri.encodeComponent(talk.id),
            extra: talk,
          ),
        ),
      ),
      GoRoute(
        path: '/saved-talks',
        builder: (context, _) => SavedTalksScreen(
          onOpenTalk: (talk) => context.push(
            '/talk/' + Uri.encodeComponent(talk.id),
            extra: talk,
          ),
        ),
      ),
      GoRoute(
        path: '/my-twin',
        builder: (_, _) => const MyTwinRouteScreen(),
      ),
      GoRoute(
        path: '/wallet',
        builder: (context, _) => WalletScreen(
          onBuyBills: () => context.push('/billing'),
          onOpenCrypto: () => context.push('/crypto'),
        ),
      ),
      GoRoute(path: '/chats', redirect: (_, __) => '/home?tab=chats'),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) {
          final entry = switch (state.uri.queryParameters['entry']) {
            'teach' => AiChatEntryMode.teach,
            'study' => AiChatEntryMode.study,
            'voice-note' => AiChatEntryMode.liveTalk,
            'live-talk' => AiChatEntryMode.liveTalk,
            'live-voice' => AiChatEntryMode.liveVoice,
            'cafe' => AiChatEntryMode.cafe,
            _ => AiChatEntryMode.chat,
          };
          final twinSetup = state.uri.queryParameters['twinSetup'] == '1';
          return AiChatScreen(
            characterId: state.pathParameters['id']!,
            entryMode: entry,
            initialPrompt: state.uri.queryParameters['prompt'],
            twinSetup: twinSetup,
            twinGender: state.uri.queryParameters['gender'],
            twinAge: int.tryParse(state.uri.queryParameters['age'] ?? ''),
            twinPhotoPath: state.uri.queryParameters['photo'],
          );
        },
      ),
      GoRoute(
        path: '/owner-session/:characterId/:requestId',
        builder: (context, state) => OwnerAccessSessionScreen(
          characterId: state.pathParameters['characterId']!,
          requestId: state.pathParameters['requestId']!,
        ),
      ),
      GoRoute(
        path: '/twin/:publicId',
        builder: (context, state) => _TwinLinkResolverScreen(
          publicId: state.pathParameters['publicId']!,
        ),
      ),
      // Preserve the historical directory action independently of bottom tabs.
      // A new-chat entry must not loop back to the Chats inbox.
      GoRoute(path: '/agents', builder: (_, _) => const AgentListScreen()),
      GoRoute(path: '/masana', builder: (_, _) => const AgentListScreen()),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(
        path: '/billing',
        builder: (_, state) => BillingScreen(
          initialService: state.uri.queryParameters['service'],
        ),
      ),
      GoRoute(path: '/crypto', builder: (_, _) => const CryptoWalletScreen()),
      GoRoute(path: '/clone', builder: (_, _) => const CloneSetupScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const EditProfileScreen()),
    ],
  );

  ref.listen(isSignedInProvider, (_, _) => router.refresh());
  return router;
});

class _TwinLinkResolverScreen extends ConsumerStatefulWidget {
  const _TwinLinkResolverScreen({required this.publicId});

  final String publicId;

  @override
  ConsumerState<_TwinLinkResolverScreen> createState() =>
      _TwinLinkResolverScreenState();
}

class _TwinLinkResolverScreenState
    extends ConsumerState<_TwinLinkResolverScreen> {
  String? _error;
  bool _resolving = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
  }

  Future<void> _resolve() async {
    if (!_resolving) {
      setState(() {
        _resolving = true;
        _error = null;
      });
    }
    try {
      final twin = await ref.read(twinDirectoryTransportProvider).resolve(
            publicId: widget.publicId,
          );
      if (!mounted) return;
      if (twin == null) {
        setState(() {
          _resolving = false;
          _error =
              'This Twin is private or the share link is no longer available.';
        });
        return;
      }
      context.go('/chat/' + Uri.encodeComponent(twin.characterId));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _resolving = false;
        _error = 'Could not open this Twin right now.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_resolving) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Open Twin')),
      body: SafeArea(
        minimum: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.link_off_outlined, size: 42),
                const SizedBox(height: 16),
                Text(
                  _error ?? 'This Twin link is unavailable.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _resolve,
                  child: const Text('Try again'),
                ),
                TextButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Back home'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
