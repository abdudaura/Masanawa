import 'package:flutter/material.dart';

import '../tokens/masanawa_tokens.dart';

class MasanawaColors extends ThemeExtension<MasanawaColors> {
  const MasanawaColors({
    required this.brand,
    required this.brandStrong,
    required this.brandGradientFrom,
    required this.brandGradientTo,
    required this.emergency,
    required this.warning,
    required this.success,
    required this.textPrimary,
    required this.textMuted,
    required this.surfaceBg,
    required this.surfaceCard,
    required this.surfaceMuted,
    required this.structuralBorder,
  });

  final Color brand;
  final Color brandStrong;
  final Color brandGradientFrom;
  final Color brandGradientTo;
  final Color emergency;
  final Color warning;
  final Color success;
  final Color textPrimary;
  final Color textMuted;
  final Color surfaceBg;
  final Color surfaceCard;
  final Color surfaceMuted;
  final Color structuralBorder;

  static MasanawaColors _from(ColorTokens t) {
    Color hex(String value) =>
        Color(int.parse(value.replaceFirst('#', ''), radix: 16) + 0xFF000000);
    return MasanawaColors(
      brand: hex(t.brandPrimary),
      brandStrong: hex(t.brandStrong),
      brandGradientFrom: hex(t.brandGradient.from),
      brandGradientTo: hex(t.brandGradient.to),
      emergency: hex(t.emergency),
      warning: hex(t.warning),
      success: hex(t.success),
      textPrimary: hex(t.textPrimary),
      textMuted: hex(t.textMuted),
      surfaceBg: hex(t.surfaceBg),
      surfaceCard: hex(t.surfaceCard),
      surfaceMuted: hex(t.surfaceMuted),
      structuralBorder: hex(t.structuralBorder),
    );
  }

  static MasanawaColors light() => _from(MasanawaTokens.light);
  static MasanawaColors dark() => _from(MasanawaTokens.dark);

  @override
  MasanawaColors copyWith({
    Color? brand,
    Color? brandStrong,
    Color? brandGradientFrom,
    Color? brandGradientTo,
    Color? emergency,
    Color? warning,
    Color? success,
    Color? textPrimary,
    Color? textMuted,
    Color? surfaceBg,
    Color? surfaceCard,
    Color? surfaceMuted,
    Color? structuralBorder,
  }) =>
      MasanawaColors(
        brand: brand ?? this.brand,
        brandStrong: brandStrong ?? this.brandStrong,
        brandGradientFrom: brandGradientFrom ?? this.brandGradientFrom,
        brandGradientTo: brandGradientTo ?? this.brandGradientTo,
        emergency: emergency ?? this.emergency,
        warning: warning ?? this.warning,
        success: success ?? this.success,
        textPrimary: textPrimary ?? this.textPrimary,
        textMuted: textMuted ?? this.textMuted,
        surfaceBg: surfaceBg ?? this.surfaceBg,
        surfaceCard: surfaceCard ?? this.surfaceCard,
        surfaceMuted: surfaceMuted ?? this.surfaceMuted,
        structuralBorder: structuralBorder ?? this.structuralBorder,
      );

  @override
  MasanawaColors lerp(MasanawaColors? other, double t) {
    if (other == null) return this;
    Color blend(Color a, Color b) => Color.lerp(a, b, t)!;
    return MasanawaColors(
      brand: blend(brand, other.brand),
      brandStrong: blend(brandStrong, other.brandStrong),
      brandGradientFrom: blend(brandGradientFrom, other.brandGradientFrom),
      brandGradientTo: blend(brandGradientTo, other.brandGradientTo),
      emergency: blend(emergency, other.emergency),
      warning: blend(warning, other.warning),
      success: blend(success, other.success),
      textPrimary: blend(textPrimary, other.textPrimary),
      textMuted: blend(textMuted, other.textMuted),
      surfaceBg: blend(surfaceBg, other.surfaceBg),
      surfaceCard: blend(surfaceCard, other.surfaceCard),
      surfaceMuted: blend(surfaceMuted, other.surfaceMuted),
      structuralBorder: blend(structuralBorder, other.structuralBorder),
    );
  }
}

extension MasanawaContext on BuildContext {
  MasanawaColors get masanawa => Theme.of(this).extension<MasanawaColors>()!;
}

ThemeData buildMasanawaTheme({required Brightness brightness}) {
  final colors =
      brightness == Brightness.dark ? MasanawaColors.dark() : MasanawaColors.light();
  final scheme = ColorScheme(
    brightness: brightness,
    primary: colors.brand,
    onPrimary: Colors.white,
    secondary: colors.brandStrong,
    onSecondary: Colors.white,
    error: colors.emergency,
    onError: Colors.white,
    surface: colors.surfaceCard,
    onSurface: colors.textPrimary,
    surfaceContainerHighest: colors.surfaceMuted,
    onSurfaceVariant: colors.textMuted,
    outline: colors.structuralBorder,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: colors.surfaceBg,
    extensions: [colors],
    appBarTheme: AppBarTheme(
      backgroundColor: colors.surfaceCard,
      foregroundColor: colors.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: colors.surfaceCard,
      indicatorColor: colors.brand.withValues(alpha: .14),
    ),
    cardTheme: CardThemeData(
      color: colors.surfaceCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: colors.structuralBorder),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.surfaceMuted,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colors.structuralBorder),
      ),
    ),
  );
}
