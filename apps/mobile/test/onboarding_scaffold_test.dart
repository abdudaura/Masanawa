import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/onboarding_scaffold.dart';

Widget _host({
  required Size size,
  double keyboardInset = 0,
}) {
  return MaterialApp(
    theme: buildMasanawaTheme(brightness: Brightness.light),
    home: MediaQuery(
      data: MediaQueryData(
        size: size,
        viewInsets: EdgeInsets.only(bottom: keyboardInset),
      ),
      child: OnboardingScaffold(
        title: 'Welcome back',
        subtitle: 'Sign in to continue to Masanawa.',
        child: Column(
          key: const ValueKey('auth-form'),
          mainAxisSize: MainAxisSize.min,
          children: const [
            TextField(),
            SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                onPressed: null,
                child: Text('Continue'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('auth content is vertically balanced on a normal phone',
      (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_host(size: const Size(412, 915)));
    await tester.pump();

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.byKey(const ValueKey('auth-form')), findsOneWidget);
    expect(tester.takeException(), isNull);

    final titleRect = tester.getRect(find.text('Welcome back'));
    final formRect = tester.getRect(find.byKey(const ValueKey('auth-form')));

    // Regression: the old auth shell packed everything into the top of the
    // screen. Keep the useful content in the central reading zone instead.
    expect(titleRect.top, greaterThan(250));
    expect(formRect.bottom, lessThan(800));
  });

  testWidgets('compact keyboard layout remains scrollable without overflow',
      (tester) async {
    tester.view.physicalSize = const Size(360, 600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      _host(
        size: const Size(360, 600),
        keyboardInset: 280,
      ),
    );
    await tester.pump();

    expect(find.byType(SingleChildScrollView), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.drag(
      find.byType(SingleChildScrollView),
      const Offset(0, -240),
    );
    await tester.pump();

    expect(find.text('Continue'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
