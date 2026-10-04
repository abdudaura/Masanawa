/// Masanawa design tokens — Agent Blue (ratified 2026-10-04).
///
/// Canonical mobile color source for the Masanawa agent-blue identity.
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
    brandPrimary: '#0A6FFA',
    brandStrong: '#0121D2',
    brandGradient: TokenGradient('#0121D2', '#1DA4FD'),
    verified: '#0A6FFA',
    emergency: '#DC2626',
    warning: '#D97706',
    success: '#16A34A',
    textPrimary: '#0A1830',
    textMuted: '#526A86',
    surfaceBg: '#F6FAFF',
    surfaceCard: '#FFFFFF',
    surfaceMuted: '#EAF4FF',
    structuralBorder: '#D6E8FF',
  );

  static const ColorTokens dark = ColorTokens(
    brandPrimary: '#36C0FF',
    brandStrong: '#79DBFF',
    brandGradient: TokenGradient('#034EF6', '#24B9FF'),
    verified: '#5BCBFF',
    emergency: '#F87171',
    warning: '#FBBF24',
    success: '#4ADE80',
    textPrimary: '#F3F8FF',
    textMuted: '#9AB7D8',
    surfaceBg: '#06132C',
    surfaceCard: '#0B1E3F',
    surfaceMuted: '#102B52',
    structuralBorder: '#1F4F87',
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
