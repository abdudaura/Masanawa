import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/main.dart';

/// Cold-start smoke test: the app mounts, the router resolves to splash,
/// and the session provider is wired without crashing.
void main() {
  testWidgets('app boots to the splash screen with a fresh install',
      (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: UnigeriaApp()),
    );
    await tester.pump();

    // The splash owns the brand moment; it renders the wordmark.
    expect(find.text('Masanawa'), findsWidgets);
    expect(tester.takeException(), isNull);

    // Advance past the ≤1.5 s brand moment → router sends fresh installs to
    // phone login.
    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pumpAndSettle();
    expect(find.text('Chat with your Masana Agents.'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
