import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  test('R01 selects the requested semantic palette without overrides', () {
    final theme = buildMasanawaTheme(brightness: Brightness.dark);
    expect(theme.brightness, Brightness.dark);
    expect(theme.colorScheme.brightness, Brightness.dark);
    expect(theme.scaffoldBackgroundColor, const Color(0xFF202C33));
    expect(theme.appBarTheme.backgroundColor, const Color(0xFF202C33));
    expect(theme.appBarTheme.foregroundColor, const Color(0xFFE9EDEF));
  });

  test('R01 provides light Android bars and legible text actions', () {
    final theme = buildMasanawaTheme(brightness: Brightness.light);
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

  test('R01 uses the canonical white surface without mutating tokens', () {
    final theme = buildMasanawaTheme(brightness: Brightness.light);
    expect(theme.scaffoldBackgroundColor, theme.colorScheme.surface);
    expect(theme.scaffoldBackgroundColor, Colors.white);
    expect(theme.extension<MasanawaColors>()!.surfaceMuted,
        const Color(0xFFE7FCEB));
    expect(theme.appBarTheme.systemOverlayStyle!.statusBarIconBrightness,
        Brightness.dark);
  });

  test('R01 selection controls use green with a readable dark check', () {
    final theme = buildMasanawaTheme(brightness: Brightness.light);
    final selected = <WidgetState>{WidgetState.selected};
    expect(theme.checkboxTheme.fillColor!.resolve(selected),
        const Color(0xFF25D366));
    expect(theme.checkboxTheme.checkColor!.resolve(selected),
        const Color(0xFF111B21));
    expect(theme.switchTheme.trackColor!.resolve(selected),
        const Color(0xFF25D366));
    expect(theme.switchTheme.thumbColor!.resolve(selected),
        const Color(0xFF111B21));
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
