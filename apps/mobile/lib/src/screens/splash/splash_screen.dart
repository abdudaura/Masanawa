import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/startup_metrics.dart';
import '../../ui/components/logo.dart';
import '../../theme/masanawa_theme.dart';
import '../../state/session_state.dart';

/// Shows the brand while secure session restoration is genuinely outstanding.
/// A returning user never waits for a decorative minimum-duration timer.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Timer? _slowRestoreTimer;
  bool _firstFrameReady = false;
  bool _slowRestore = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    // Do not keep the user on a branded page for an arbitrary 1.2 seconds.
    // Waiting until the first rendered frame also avoids navigating during
    // widget construction and leaves deep-link/session routing intact.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _firstFrameReady = true;
      _navigate(ref.read(sessionProvider));
    });

    // A slow secure-storage read is NOT evidence that credentials expired.
    // The previous timeout substituted SignedOut but _navigate ignored it
    // while SessionRestoring, leaving a silent, potentially endless splash.
    _slowRestoreTimer = Timer(const Duration(milliseconds: 6200), () {
      if (!mounted || _navigated ||
          ref.read(sessionProvider) is! SessionRestoring) return;
      MasanawaStartupMetrics.mark('secure_session_slow');
      setState(() => _slowRestore = true);
    });
  }

  void _navigate(SessionState session) {
    if (!mounted || !_firstFrameReady || _navigated ||
        session is SessionRestoring) return;
    _navigated = true;
    _slowRestoreTimer?.cancel();
    MasanawaStartupMetrics.mark('session_resolved');
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
    _slowRestoreTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (_, next) {
      if (_firstFrameReady) _navigate(next);
    });
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MasanawaLogo(dark: true, height: 120, showWordmark: false),
            if (_slowRestore) ...[
              const SizedBox(height: 24),
              const CircularProgressIndicator(),
              const SizedBox(height: 12),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 28),
                child: Text(
                  'Restoring your saved session is taking longer than expected.',
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
