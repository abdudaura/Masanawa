/// Masanawa design tokens — Naija Green (RATIFIED 2026-08-11, O1).
///
/// Dart mirror of `packages/tokens/src/index.ts` — the canonical source of
/// truth. Parity is enforced by the `dart-parity` test in `packages/tokens`,
/// so these values can never drift from the TypeScript token package.
/// No raw hex in widget code — always read from this file.
library;

class TokenColor {
  const TokenColor(this.hex);
  final String hex;
}

class TokenGradient {
  const TokenGradient(this.from, this.to);
  final String from;
  final String to;
}

class ColorTokens {
  const ColorTokens({
    required this.brandPrimary,
    required this.brandStrong,
    required this.brandGradient,
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

  final String brandPrimary;
  final String brandStrong;
  final TokenGradient brandGradient;
  final String verified;
  final String emergency;
  final String warning;
  final String success;
  final String textPrimary;
  final String textMuted;
  final String surfaceBg;
  final String surfaceCard;
  final String surfaceMuted;
  final String structuralBorder;
}

/// Semantic color roles, light + dark pairs. Values match
/// `packages/tokens` exactly (parity-tested).
final class MasanawaTokens {
  const MasanawaTokens._();

  static const ColorTokens light = ColorTokens(
    brandPrimary: '#047857',
    brandStrong: '#065F46',
    brandGradient: TokenGradient('#059669', '#10B981'),
    verified: '#1D4ED8',
    emergency: '#DC2626',
    warning: '#D97706',
    success: '#16A34A',
    textPrimary: '#0F172A',
    textMuted: '#475569',
    surfaceBg: '#FAFAF9',
    surfaceCard: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    structuralBorder: '#E2E8F0',
  );

  static const ColorTokens dark = ColorTokens(
    brandPrimary: '#34D399',
    brandStrong: '#6EE7B7',
    brandGradient: TokenGradient('#10B981', '#34D399'),
    verified: '#60A5FA',
    emergency: '#F87171',
    warning: '#FBBF24',
    success: '#4ADE80',
    textPrimary: '#F1F5F9',
    textMuted: '#94A3B8',
    surfaceBg: '#0B1220',
    surfaceCard: '#111A2C',
    surfaceMuted: '#1E293B',
    structuralBorder: '#334155',
  );

  /// 4px spacing grid.
  static const Map<int, double> spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  };

  static const Map<String, double> radius = {
    'sm': 8,
    'md': 12,
    'lg': 16,
    'xl': 20,
    '2xl': 24,
    'full': 9999,
  };

  static const Map<String, int> durationMs = {
    'instant': 50,
    'fast': 150,
    'normal': 250,
    'slow': 500,
    'slower': 700,
    'slowest': 900,
  };

  static const Map<String, double> fontSize = {
    'xs': 12,
    'sm': 14,
    'md': 16,
    'lg': 20,
    'xl': 24,
    '2xl': 32,
  };

  static const Map<String, double> fontWeight = {
    'regular': 400,
    'medium': 500,
    'semibold': 600,
    'bold': 800,
  };

  /// Minimum touch target in logical pixels (a11y, §99).
  static const double touchTargetMin = 44;
}
