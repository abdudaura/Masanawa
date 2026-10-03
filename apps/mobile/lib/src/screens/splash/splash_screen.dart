import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../ui/components/logo.dart';
import '../../ui/components/masanawa_wordmark.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';
import '../../state/session_state.dart';

/// Brand moment (≤1.5 s), then route to the chats or to login when signed out.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Brand moment, then wait until restore settles (no fixed-race).
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      for (var i = 0; i < 50; i++) {
        if (!mounted) return;
        final s = ref.read(sessionProvider);
        if (s is! SessionRestoring) break;
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
      if (!mounted) return;
      final session = ref.read(sessionProvider);
      if (session is SessionSignedIn) {
        context.go(session.user.isNewUser ? '/name' : '/chats');
      } else if (session is SessionNameRequired) {
        context.go('/name');
      } else if (session is SessionAwaitingOtp ||
          session is SessionVerifying ||
          session is SessionSendingOtp) {
        context.go('/otp');
      } else {
        context.go('/phone-login');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [u.brandGradientFrom, u.brandGradientTo],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              UnigeriaLogo(dark: true, height: 120),
              SizedBox(height: UnigeriaTokens.spacing[4]),
              const MasanawaWordmark(light: true, fontSize: 30),
              SizedBox(height: UnigeriaTokens.spacing[2]),
              Text(
                'Chat with your Masana Agents.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: UnigeriaTokens.fontSize['md'],
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
