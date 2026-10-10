import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../ui/components/logo.dart';
import '../../ui/components/masanawa_wordmark.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';
import '../../state/session_state.dart';

/// Neutral brand moment (≤1.5 s), then route to the ordinary Talks root
/// or authentication. Incoming calls/deep links are routed separately.
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
      context.go('/home');
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
    _brandTimer?.cancel();
    _restoreDeadline?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (_, next) {
      if (_brandReady) _navigate(next);
    });
    // Match the Android launch window even if a dark appearance is active.
    // Global brand/theme changes must not reintroduce a coloured launch flash.
    final neutral = MasanawaColors.light();
    return Scaffold(
      backgroundColor: neutral.surfaceCard,
      body: Container(
        color: neutral.surfaceCard,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              MasanawaLogo(dark: false, height: 120, showWordmark: false),
              SizedBox(height: MasanawaTokens.spacing[4]),
              const MasanawaWordmark(light: false, fontSize: 30),
              SizedBox(height: MasanawaTokens.spacing[2]),
              Text(
                AppLocalizations.of(context).splashTagline,
                style: TextStyle(
                  color: neutral.textMuted,
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


