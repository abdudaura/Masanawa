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
        const Color(0xFF111B21));
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
    expect(indicator.valueColor?.value, const Color(0xFF111B21));
    await tester.tap(find.text('Sending code'));
    expect(submitted, 0);
  });

  testWidgets('a null callback remains safely disabled', (tester) async {
    await tester.pumpWidget(_app(const PrimaryButton(
      label: 'Unavailable',
      onPressed: null,
    )));
    expect(tester.widget<Text>(find.text('Unavailable')).style?.color,
        const Color(0xFF111B21));
  });

  testWidgets('primary action provides one enabled labeled semantic button',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(_app(PrimaryButton(
      label: 'Confirm payment',
      icon: Icons.check,
      onPressed: () => calls++,
    )));
    expect(
      find.byWidgetPredicate((widget) =>
          widget is Semantics &&
          widget.properties.button == true &&
          widget.properties.enabled == true &&
          widget.properties.label == 'Confirm payment' &&
          widget.properties.onTap != null),
      findsOneWidget,
    );
    await tester.tap(find.text('Confirm payment'));
    expect(calls, 1);
  });

  testWidgets('loading announces progress and never exposes a tap action',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(_app(PrimaryButton(
      label: 'Pay now',
      loading: true,
      onPressed: () => calls++,
    )));
    expect(
      find.byWidgetPredicate((widget) =>
          widget is Semantics &&
          widget.properties.button == true &&
          widget.properties.enabled == false &&
          widget.properties.liveRegion == true &&
          widget.properties.label == 'Pay now, in progress' &&
          widget.properties.onTap == null),
      findsOneWidget,
    );
    await tester.tap(find.text('Pay now'));
    expect(calls, 0);
  });

  testWidgets('disabled and missing handlers advertise their true status',
      (tester) async {
    await tester.pumpWidget(_app(const PrimaryButton(
      label: 'Unavailable',
      onPressed: null,
    )));
    expect(
      find.byWidgetPredicate((widget) =>
          widget is Semantics &&
          widget.properties.button == true &&
          widget.properties.enabled == false &&
          widget.properties.label == 'Unavailable' &&
          widget.properties.onTap == null),
      findsOneWidget,
    );
  });

  testWidgets('long translated action grows vertically at 320dp text scale',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 180,
            child: MediaQuery(
              data: const MediaQueryData(
                textScaler: TextScaler.linear(2.6),
              ),
              child: PrimaryButton(
                label: 'Continue with verified account confirmation',
                icon: Icons.check,
                onPressed: () {},
              ),
            ),
          ),
        ),
      ),
    ));
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(PrimaryButton)).height,
        greaterThan(48));
    expect(tester.getSize(find.byType(PrimaryButton)).width, 180);
  });

  testWidgets('reduced motion retains a visible nonanimated busy indicator',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: Scaffold(
        body: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: PrimaryButton(
            label: 'Submitting',
            loading: true,
            onPressed: () => calls++,
          ),
        ),
      ),
    ));
    expect(find.byIcon(Icons.hourglass_empty), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.tap(find.text('Submitting'));
    expect(calls, 0);
  });
}
