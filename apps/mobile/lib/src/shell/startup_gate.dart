import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_state.dart';

/// Inline authenticated shell gate. No decorative timer, extra landing route,
/// network request or embedded brand/splash stage is added to startup.
class StartupGate extends ConsumerWidget {
  const StartupGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session is SessionSignedIn && !session.user.isNewUser) {
      return child;
    }
    if (session is SessionRestoring) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    // Signed-out, denied and incomplete-profile users never receive the
    // authenticated shell while the router redirects them to their route.
    return const Scaffold(body: SizedBox.shrink());
  }
}
