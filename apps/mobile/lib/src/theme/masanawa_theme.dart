import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/masanawa_tokens.dart';

/// Resolves the Masanawa WhatsApp-derived green palette for the active brightness.
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
    required this.bubbleOut,
    required this.chatBg,
    required this.tickRead,
    required this.chatNotice,
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
  final Color bubbleOut;
  final Color chatBg;
  final Color tickRead;
  final Color chatNotice;

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
      bubbleOut: hex(t.bubbleOut),
      chatBg: hex(t.chatBg),
      tickRead: hex(t.tickRead),
      chatNotice: hex(t.chatNotice),
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
    Color? bubbleOut,
    Color? chatBg,
    Color? tickRead,
    Color? chatNotice,
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
      bubbleOut: bubbleOut ?? this.bubbleOut,
      chatBg: chatBg ?? this.chatBg,
      tickRead: tickRead ?? this.tickRead,
      chatNotice: chatNotice ?? this.chatNotice,
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
      bubbleOut: l(bubbleOut, other.bubbleOut),
      chatBg: l(chatBg, other.chatBg),
      tickRead: l(tickRead, other.tickRead),
      chatNotice: l(chatNotice, other.chatNotice),
    );
  }
}

/// Extension: `context.masanawa` — the WhatsApp-green semantic palette from the
/// active ThemeData. Widget code reads colors from here only (design DoD).
extension MasanawaContext on BuildContext {
  MasanawaColors get masanawa => Theme.of(this).extension<MasanawaColors>()!;
}

/// The Masanawa ThemeData — every screen renders from this (design DoD).
ThemeData buildMasanawaTheme({required Brightness brightness}) {
  // Theme construction follows the requested palette. Selecting the default
  // experience belongs to MaterialApp, not the semantic color factory.
  final isDark = brightness == Brightness.dark;
  final masanawa = isDark ? MasanawaColors.dark() : MasanawaColors.light();
  final scheme = ColorScheme(
    brightness: brightness,
    primary: masanawa.brand,
    onPrimary: isDark ? Colors.black87 : masanawa.textPrimary,
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
    // Normal app surfaces are white in light mode; keep the canonical
    // muted background token for components that need secondary surfaces.
    scaffoldBackgroundColor: masanawa.surfaceCard,
    extensions: [masanawa],
    textTheme: Typography.material2021(platform: TargetPlatform.android).black.apply(
          bodyColor: scheme.onSurface,
          displayColor: scheme.onSurface,
        ),
    appBarTheme: AppBarTheme(
      backgroundColor: masanawa.surfaceCard,
      foregroundColor: masanawa.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      // Light Android system bar with dark status icons, matching this header.
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
        statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
        systemNavigationBarColor: masanawa.surfaceCard,
        systemNavigationBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      ),
      iconTheme: IconThemeData(color: masanawa.textPrimary),
      actionsIconTheme: IconThemeData(color: masanawa.textPrimary),
      titleTextStyle: TextStyle(
        color: masanawa.textPrimary,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: masanawa.surfaceCard,
      indicatorColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? masanawa.brandStrong
              : masanawa.textMuted,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected)
              ? masanawa.brandStrong
              : masanawa.textMuted,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
        ),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: masanawa.brand,
      foregroundColor: masanawa.textPrimary,
    ),
    cardTheme: CardThemeData(
      color: masanawa.surfaceCard,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: masanawa.surfaceCard,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: masanawa.surfaceCard,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: masanawa.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: masanawa.brand,
        foregroundColor: masanawa.textPrimary,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: masanawa.brandStrong,
        minimumSize: const Size(48, 48),
        side: BorderSide(color: masanawa.structuralBorder),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: masanawa.brandStrong),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: masanawa.surfaceMuted,
      selectedColor: masanawa.brand.withValues(alpha: .14),
      side: BorderSide(color: masanawa.structuralBorder),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
      ),
      labelStyle: TextStyle(color: masanawa.textPrimary),
      secondaryLabelStyle: TextStyle(color: masanawa.brandStrong),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? masanawa.brandStrong
              : masanawa.textMuted,
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? masanawa.brand.withValues(alpha: .12)
              : masanawa.surfaceCard,
        ),
        side: WidgetStatePropertyAll(
          BorderSide(color: masanawa.structuralBorder),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: masanawa.surfaceCard,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: masanawa.structuralBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: masanawa.brand, width: 1.6),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? masanawa.brand
              : masanawa.surfaceCard),
      checkColor: WidgetStatePropertyAll(masanawa.textPrimary),
      side: BorderSide(color: masanawa.textMuted, width: 1.5),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? masanawa.textPrimary
              : masanawa.surfaceCard),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? masanawa.brand
              : masanawa.surfaceMuted),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: masanawa.brand,
      selectionColor: masanawa.brand.withValues(alpha: 0.22),
      selectionHandleColor: masanawa.brand,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: masanawa.brand,
      linearTrackColor: masanawa.surfaceMuted,
    ),
    dividerTheme: DividerThemeData(color: masanawa.structuralBorder),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: masanawa.textPrimary,
      contentTextStyle: TextStyle(
        color: Colors.white,
      ),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
    splashFactory: InkSparkle.splashFactory,
    visualDensity: VisualDensity.standard,
  );
}