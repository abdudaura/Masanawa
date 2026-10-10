import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

// Contrast of foreground and background under WCAG 2.x for normal text.
double _contrast(Color first, Color second) {
  final a = first.computeLuminance();
  final b = second.computeLuminance();
  return (a > b ? a + 0.05 : b + 0.05) /
      (a > b ? b + 0.05 : a + 0.05);
}

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    test('$brightness: Snackbar and error semantic text remain accessible', () {
      final theme = buildMasanawaTheme(brightness: brightness);
      final snackbarBackground = theme.snackBarTheme.backgroundColor;
      final snackbarForeground = theme.snackBarTheme.contentTextStyle?.color;

      expect(snackbarBackground, isNotNull);
      expect(snackbarForeground, isNotNull);
      expect(_contrast(snackbarBackground!, snackbarForeground!),
          greaterThanOrEqualTo(4.5));
      expect(_contrast(theme.colorScheme.error, theme.colorScheme.onError),
          greaterThanOrEqualTo(4.5));
    });

    testWidgets('$brightness: rendered Snackbar uses accessible theme',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: buildMasanawaTheme(brightness: brightness),
        home: Scaffold(
          body: Builder(builder: (context) {
            return ElevatedButton(
              onPressed: () => ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Saved'))),
              child: const Text('Show'),
            );
          }),
        ),
      ));
      await tester.tap(find.text('Show'));
      await tester.pump();
      expect(find.text('Saved'), findsOneWidget);
      final snackbar = tester.widget<SnackBar>(find.byType(SnackBar));
      expect(snackbar.content, isA<Text>());
      final theme = buildMasanawaTheme(brightness: brightness);
      expect(_contrast(theme.snackBarTheme.backgroundColor!,
              theme.snackBarTheme.contentTextStyle!.color!),
          greaterThanOrEqualTo(4.5));
    });
  }
}
