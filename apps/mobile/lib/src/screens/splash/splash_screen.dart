import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../ui/components/logo.dart';
import '../../theme/masanawa_theme.dart';
import '../../state/session_state.dart';

/// Brand moment (≤1.5 s), then route to the chats or to login when signed out.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Timer? _brandTimer;
  Timer? _restoreDeadline;
  bool _brandReady = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _brandTimer = Timer(const Duration(milliseconds: 1200), () {
      _brandReady = true;
      _navigate(ref.read(sessionProvider));
    });
    // Preserve the original bounded restore wait without polling.
    _restoreDeadline = Timer(const Duration(milliseconds: 6200), () {
      if (!mounted || _navigated) return;
      final session = ref.read(sessionProvider);
      _navigate(session is SessionRestoring
          ? const SessionSignedOut()
          : session);
    });
  }

  void _navigate(SessionState session) {
    if (!mounted || !_brandReady || _navigated ||
        session is SessionRestoring) return;
    _navigated = true;
    _brandTimer?.cancel();
    _restoreDeadline?.cancel();
    if (session is SessionSignedIn) {
      context.go('/chats');
    } else if (session is SessionNameRequired ||
        session is SessionRegisterProfile) {
      context.go('/name');
    } else if (session is SessionPasswordRequired) {
      context.go(
        '/password?phone=${Uri.encodeComponent(session.identifier)}'
        '&setup=${session.setup ? '1' : '0'}',
      );
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
    _brandTimer?.cancel();
    _restoreDeadline?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (_, next) {
      if (_brandReady) _navigate(next);
    });
    final u = context.masanawa;
    // WhatsApp-style launch moment: plain background, centered mark, no
    // tagline and no gradient. Routing and timings below are untouched.
    return Scaffold(
      backgroundColor: u.surfaceBg,
      body: Center(
        child: MasanawaLogo(dark: true, height: 120, showWordmark: false),
      ),
    );
  }
}


