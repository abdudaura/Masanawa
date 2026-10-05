import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../ui/components/logo.dart';
import '../../ui/components/masanawa_wordmark.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';
import '../../state/session_state.dart';

/// First-frame brand surface. Navigation starts as soon as session restore resolves;
/// there is deliberately no minimum splash duration.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Timer? _restoreDeadline;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();

    // Let Flutter paint one frame, then leave immediately when the session is
    // already known. This avoids the previous artificial 1.2 s brand delay.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _navigate(ref.read(sessionProvider));
    });

    // Fail open to sign-in rather than leaving a user trapped on splash if a
    // device keystore/plugin restore stalls unexpectedly.
    _restoreDeadline = Timer(const Duration(milliseconds: 6200), () {
      if (!mounted || _navigated) return;
      final session = ref.read(sessionProvider);
      _navigate(session is SessionRestoring
          ? const SessionSignedOut()
          : session);
    });
  }

  void _navigate(SessionState session) {
    if (!mounted || _navigated || session is SessionRestoring) return;
    _navigated = true;
    _restoreDeadline?.cancel();

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
  }

  @override
  void dispose() {
    _restoreDeadline?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (_, next) => _navigate(next));
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
              const MasanawaLogo(
                dark: true,
                height: 120,
                showWordmark: false,
              ),
              SizedBox(height: MasanawaTokens.spacing[4]),
              const MasanawaWordmark(light: true, fontSize: 30),
              SizedBox(height: MasanawaTokens.spacing[2]),
              Text(
                'Talk. Work. Get things done.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: MasanawaTokens.fontSize['md'],
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
