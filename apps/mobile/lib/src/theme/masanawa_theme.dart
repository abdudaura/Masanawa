import 'package:flutter/material.dart';

import '../tokens/masanawa_tokens.dart';

/// Resolves the Naija Green palette for the active brightness.
///
/// The palette is token-driven only — semantic roles fixed by BRAND-KIT §3.
/// Widget code never reads raw hex; it reads this extension off the Theme.
class MasanawaColors extends ThemeExtension<MasanawaColors> {
  const MasanawaColors({
    required this.brand,
    required this.brandStrong,
    required this.brandGradientFrom,
    required this.brandGradientTo,
    required this.verified,
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
  final Color verified;
  final Color emergency;
  final Color warning;
  final Color success;
  final Color textPrimary;
  final Color textMuted;
  final Color surfaceBg;
  final Color surfaceCard;
  final Color surfaceMuted;
  final Color structuralBorder;

  static MasanawaColors light() => _from(MasanawaTokens.light);

  static MasanawaColors dark() => _from(MasanawaTokens.dark);

  static MasanawaColors _from(ColorTokens t) {
    Color hex(String v) => Color(int.parse(v.replaceFirst('#', ''), radix: 16) + 0xFF000000);
    return MasanawaColors(
      brand: hex(t.brandPrimary),
      brandStrong: hex(t.brandStrong),
      brandGradientFrom: hex(t.brandGradient.from),
      brandGradientTo: hex(t.brandGradient.to),
      verified: hex(t.verified),
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

  @override
  MasanawaColors copyWith({
    Color? brand,
    Color? brandStrong,
    Color? brandGradientFrom,
    Color? brandGradientTo,
    Color? verified,
    Color? emergency,
    Color? warning,
    Color? success,
    Color? textPrimary,
    Color? textMuted,
    Color? surfaceBg,
    Color? surfaceCard,
    Color? surfaceMuted,
    Color? structuralBorder,
  }) {
    return MasanawaColors(
      brand: brand ?? this.brand,
      brandStrong: brandStrong ?? this.brandStrong,
      brandGradientFrom: brandGradientFrom ?? this.brandGradientFrom,
      brandGradientTo: brandGradientTo ?? this.brandGradientTo,
      verified: verified ?? this.verified,
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
  }

  @override
  MasanawaColors lerp(MasanawaColors? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return MasanawaColors(
      brand: l(brand, other.brand),
      brandStrong: l(brandStrong, other.brandStrong),
      brandGradientFrom: l(brandGradientFrom, other.brandGradientFrom),
      brandGradientTo: l(brandGradientTo, other.brandGradientTo),
      verified: l(verified, other.verified),
      emergency: l(emergency, other.emergency),
      warning: l(warning, other.warning),
      success: l(success, other.success),
      textPrimary: l(textPrimary, other.textPrimary),
      textMuted: l(textMuted, other.textMuted),
      surfaceBg: l(surfaceBg, other.surfaceBg),
      surfaceCard: l(surfaceCard, other.surfaceCard),
      surfaceMuted: l(surfaceMuted, other.surfaceMuted),
      structuralBorder: l(structuralBorder, other.structuralBorder),
    );
  }
}

/// Extension: `context.masanawa` — the Naija Green semantic palette from the
/// active ThemeData. Widget code reads colors from here only (design DoD).
extension MasanawaContext on BuildContext {
  MasanawaColors get masanawa => Theme.of(this).extension<MasanawaColors>()!;
}

/// The Masanawa ThemeData — every screen renders from this (design DoD).
ThemeData buildMasanawaTheme({required Brightness brightness}) {
  final isDark = brightness == Brightness.dark;
  final masanawa = isDark ? MasanawaColors.dark() : MasanawaColors.light();
  final scheme = ColorScheme(
    brightness: brightness,
    primary: masanawa.brand,
    onPrimary: isDark ? Colors.black87 : Colors.white,
    secondary: masanawa.brandStrong,
    onSecondary: isDark ? Colors.black87 : Colors.white,
    error: masanawa.emergency,
    onError: Colors.white,
    surface: masanawa.surfaceCard,
    onSurface: masanawa.textPrimary,
    surfaceContainerHighest: masanawa.surfaceMuted,
    onSurfaceVariant: masanawa.textMuted,
    outline: masanawa.structuralBorder,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: masanawa.surfaceBg,
    extensions: [masanawa],
    textTheme: Typography.material2021(platform: TargetPlatform.android).black.apply(
          bodyColor: scheme.onSurface,
          displayColor: scheme.onSurface,
        ),
    splashFactory: InkSparkle.splashFactory,
    visualDensity: VisualDensity.standard,
  );
}