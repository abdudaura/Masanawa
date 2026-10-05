import 'package:flutter/material.dart';
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
import '../state/twin_directory_state.dart';

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

      // Signed-out users can only be in auth. Native/public share links are
      // normally held by PendingDeepLink until a canonical session exists.
      final protected = path == '/home' ||
          path == '/chats' ||
          path.startsWith('/chat/') ||
          path.startsWith('/twin/') ||
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
      GoRoute(
        path: '/twin/:publicId',
        builder: (context, state) => _TwinLinkResolverScreen(
          publicId: state.pathParameters['publicId']!,
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
          _error = 'This Twin is private or the share link is no longer available.';
        });
        return;
      }
      context.go('/chat/${Uri.encodeComponent(twin.characterId)}');
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
                  child: const Text('Explore other Twins'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
