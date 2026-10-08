import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  test('R01 stays light when dark brightness is requested', () {
    final theme = buildMasanawaTheme(brightness: Brightness.dark);
    expect(theme.brightness, Brightness.light);
    expect(theme.colorScheme.brightness, Brightness.light);
    expect(theme.scaffoldBackgroundColor, Colors.white);
    expect(theme.appBarTheme.backgroundColor, Colors.white);
    expect(theme.appBarTheme.foregroundColor, const Color(0xFF111B21));
  });

  test('R01 provides light Android bars and legible text actions', () {
    final theme = buildMasanawaTheme(brightness: Brightness.dark);
    final overlay = theme.appBarTheme.systemOverlayStyle!;
    expect(overlay.statusBarIconBrightness, Brightness.dark);
    expect(overlay.statusBarBrightness, Brightness.light);
    expect(overlay.systemNavigationBarColor, Colors.white);
    expect(overlay.systemNavigationBarIconBrightness, Brightness.dark);
    expect(theme.textButtonTheme.style!.foregroundColor!
        .resolve(<WidgetState>{}), const Color(0xFF075E54));
    expect(theme.outlinedButtonTheme.style!.foregroundColor!
        .resolve(<WidgetState>{}), const Color(0xFF075E54));
  });

  test('R01 accessible foreground is dark on vibrant green actions', () {
    final theme = buildMasanawaTheme(brightness: Brightness.light);
    final style = theme.filledButtonTheme.style!;
    final foreground = style.foregroundColor!.resolve(<WidgetState>{});
    final background = style.backgroundColor!.resolve(<WidgetState>{});
    expect(background, const Color(0xFF25D366));
    expect(foreground, const Color(0xFF111B21));
    expect(theme.floatingActionButtonTheme.foregroundColor,
        const Color(0xFF111B21));
  });
}
