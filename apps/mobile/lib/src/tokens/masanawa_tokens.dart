/// Masanawa design tokens — WhatsApp-derived green identity.
///
/// Canonical mobile color source for the Masanawa WhatsApp-like identity.
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
    required this.bubbleOut,
    required this.chatBg,
    required this.tickRead,
    required this.chatNotice,
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

  /// Outgoing message bubble. Values read from the WhatsApp 2.26 APK
  /// (light #D9FDD3 verified; dark #144D37 evidence-matched).
  final String bubbleOut;

  /// Conversation background (light classic #EFEAE2; dark #0B141A verified).
  final String chatBg;

  /// Read-receipt blue, both modes (verified #53BDEB in the APK).
  final String tickRead;

  /// Encryption-notice yellow (visual match; not file-verified).
  final String chatNotice;
}

/// Semantic color roles, light + dark pairs. Values match
/// `packages/tokens` exactly (parity-tested).
final class MasanawaTokens {
  const MasanawaTokens._();

  static const ColorTokens light = ColorTokens(
    // Familiar WhatsApp palette, deliberately adopted end-to-end.
    brandPrimary: '#25D366',
    brandStrong: '#075E54',
    brandGradient: TokenGradient('#25D366', '#128C7E'),
    verified: '#128C7E',
    emergency: '#D32F2F',
    warning: '#F59E0B',
    success: '#25D366',
    textPrimary: '#111B21',
    textMuted: '#54656F',
    surfaceBg: '#F0F2F5',
    surfaceCard: '#FFFFFF',
    surfaceMuted: '#E7FCEB',
    structuralBorder: '#E9EDEF',
    bubbleOut: '#D9FDD3',
    chatBg: '#EFEAE2',
    tickRead: '#53BDEB',
    chatNotice: '#FFD279',
  );

  static const ColorTokens dark = ColorTokens(
    brandPrimary: '#00A884',
    brandStrong: '#00A884',
    brandGradient: TokenGradient('#00A884', '#25D366'),
    verified: '#53BDEB',
    emergency: '#F15C6D',
    warning: '#F7B928',
    success: '#00A884',
    textPrimary: '#E9EDEF',
    textMuted: '#8696A0',
    surfaceBg: '#0B141A',
    surfaceCard: '#202C33',
    surfaceMuted: '#2A3942',
    structuralBorder: '#2F3B43',
    bubbleOut: '#144D37',
    chatBg: '#0B141A',
    tickRead: '#53BDEB',
    chatNotice: '#FFD279',
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
