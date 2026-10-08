import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/primary_button.dart';

double _contrast(Color a, Color b) {
  final first = a.computeLuminance();
  final second = b.computeLuminance();
  final brighter = first > second ? first : second;
  final darker = first > second ? second : first;
  return (brighter + 0.05) / (darker + 0.05);
}

Widget _app(Widget child) => MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  test('shared PrimaryButton uses WCAG-readable onPrimary on green', () {
    final theme = buildMasanawaTheme(brightness: Brightness.light);
    expect(theme.colorScheme.primary, const Color(0xFF25D366));
    expect(theme.colorScheme.onPrimary, const Color(0xFF111B21));
    expect(_contrast(theme.colorScheme.primary, theme.colorScheme.onPrimary),
        greaterThanOrEqualTo(4.5));
    expect(_contrast(theme.colorScheme.primary, Colors.white), lessThan(4.5));
  });

  testWidgets('enabled label/icon are dark and the action still triggers', (tester) async {
    var submitted = 0;
    await tester.pumpWidget(_app(PrimaryButton(
      label: 'Continue',
      icon: Icons.arrow_forward,
      onPressed: () => submitted++,
    )));
    expect(tester.widget<Text>(find.text('Continue')).style?.color,
        const Color(0xFF111B21));
    final icon = tester.widget<Icon>(find.byIcon(Icons.arrow_forward));
    expect(icon.color, const Color(0xFF111B21));
    await tester.tap(find.text('Continue'));
    expect(submitted, 1);
  });

  testWidgets('disabled actions stay visibly disabled and cannot submit', (tester) async {
    var submitted = 0;
    await tester.pumpWidget(_app(PrimaryButton(
      label: 'Continue',
      enabled: false,
      onPressed: () => submitted++,
    )));
    expect(tester.widget<Text>(find.text('Continue')).style?.color,
        const Color(0xFF667781));
    await tester.tap(find.text('Continue'));
    expect(submitted, 0);
  });

  testWidgets('loading uses a readable spinner and cannot resubmit', (tester) async {
    var submitted = 0;
    await tester.pumpWidget(_app(PrimaryButton(
      label: 'Sending code',
      loading: true,
      onPressed: () => submitted++,
    )));
    final indicator = tester.widget<CircularProgressIndicator>(
      find.byType(CircularProgressIndicator),
    );
    expect(indicator.valueColor?.value, const Color(0xFF667781));
    await tester.tap(find.text('Sending code'));
    expect(submitted, 0);
  });

  testWidgets('a null callback remains safely disabled', (tester) async {
    await tester.pumpWidget(_app(const PrimaryButton(
      label: 'Unavailable',
      onPressed: null,
    )));
    expect(tester.widget<Text>(find.text('Unavailable')).style?.color,
        const Color(0xFF667781));
  });
}
