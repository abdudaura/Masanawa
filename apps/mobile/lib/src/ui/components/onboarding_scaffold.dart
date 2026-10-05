import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';
import 'logo.dart';

/// Shared onboarding/auth scaffold.
///
/// Auth screens stay vertically balanced on normal phones while remaining
/// scrollable on compact screens and when the keyboard is visible.
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
      canPop: !canGoBack,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && canGoBack) goBack();
      },
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
              final compact = constraints.maxHeight < 640;
              final horizontalPadding = constraints.maxWidth >= 600 ? 40.0 : 24.0;
              final verticalPadding = compact ? 16.0 : 28.0;
              final bottomPadding = math.max(
                verticalPadding,
                keyboardInset > 0 ? keyboardInset + 16 : verticalPadding,
              );
              final minContentHeight = math.max(
                0.0,
                constraints.maxHeight - verticalPadding - bottomPadding,
              );

              return SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsets.fromLTRB(
                  horizontalPadding,
                  verticalPadding,
                  horizontalPadding,
                  bottomPadding,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: minContentHeight),
                  child: Stack(
                    children: [
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 460),
                          child: Padding(
                            padding: EdgeInsets.only(
                              top: canGoBack ? 44 : 0,
                              bottom: canGoBack ? 8 : 0,
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Center(
                                  child: MasanawaLogo(
                                    height: compact ? 64 : 80,
                                  ),
                                ),
                                if (title != null) ...[
                                  SizedBox(height: compact ? 20 : 28),
                                  Text(
                                    title!,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: MasanawaTokens.fontSize['xl'],
                                      fontWeight: FontWeight.w700,
                                      height: 1.15,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface,
                                    ),
                                  ),
                                ],
                                if (subtitle != null) ...[
                                  const SizedBox(height: 10),
                                  Text(
                                    subtitle!,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: MasanawaTokens.fontSize['md'],
                                      height: 1.45,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                                  ),
                                ],
                                SizedBox(height: compact ? 24 : 34),
                                child,
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (canGoBack)
                        Positioned(
                          top: 0,
                          left: 0,
                          child: IconButton(
                            icon: Icon(
                              Icons.arrow_back_ios_new,
                              color: u.brand,
                            ),
                            onPressed: goBack,
                            tooltip: 'Back',
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
