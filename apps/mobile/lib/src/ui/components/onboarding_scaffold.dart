import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';
import 'logo.dart';

/// Shared onboarding/auth scaffold — every auth/onboarding screen carries the
/// logo + wordmark (design discipline), token-driven spacing, and a back arrow
/// when the flow allows returning. Back navigation is deterministic: the flow
/// is a linear chain, so the caller declares the exact destination and both
/// the arrow and the system back gesture use `context.go` (never `pop`, which
/// can leave a stale intermediate page on the stack).
class OnboardingScaffold extends StatelessWidget {
  const OnboardingScaffold({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.canGoBack = false,
    this.backDestination,
  });

  final Widget child;
  final String? title;
  final String? subtitle;
  final bool canGoBack;

  /// Exact route to go back to (e.g. `/phone-login` from the OTP screen).
  final String? backDestination;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final goBack = backDestination != null
        ? () => context.go(backDestination!)
        : () => context.pop();
    return PopScope(
      // With `canGoBack` the flow intercepts system back to land on the
      // declared destination instead of popping unpredictably.
      canPop: !canGoBack,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && canGoBack) goBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (canGoBack)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      icon: Icon(Icons.arrow_back_ios_new, color: u.brand),
                      onPressed: goBack,
                      tooltip: 'Back',
                    ),
                  ),
                const SizedBox(height: 8),
                Center(child: MasanawaLogo(height: 72)),
                if (title != null) ...[
                  const SizedBox(height: 24),
                  Text(
                    title!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: MasanawaTokens.fontSize['xl'],
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ],
                if (subtitle != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    subtitle!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: MasanawaTokens.fontSize['md'],
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
