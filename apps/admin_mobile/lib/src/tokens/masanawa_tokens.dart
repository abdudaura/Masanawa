library;

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

final class MasanawaTokens {
  const MasanawaTokens._();
  static const ColorTokens light = ColorTokens(
    brandPrimary: '#0A6FFA',
    brandStrong: '#0121D2',
    brandGradient: TokenGradient('#0121D2', '#1DA4FD'),
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
}
