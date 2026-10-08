import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import '../../l10n/app_localizations.dart';

/// UI locale is independent of the language spoken to an AI or wallet region.
/// Add translated application resources before claiming an entire locale is
/// translated. Flutter's stock Material/Cupertino labels are localized now.
abstract final class MasanawaLocalization {
  // Hausa needs a dedicated Material/Cupertino delegate; stock Flutter
  // does not support 'ha'. Keep English UI fallback until integrated.
  static const supportedLocales = <Locale>[
    Locale('en'),
    Locale('ar'),
    Locale('fr'),
    Locale('es'),
    Locale('pt'),
  ];

  static const delegates = <LocalizationsDelegate<dynamic>>[
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// Honor the device's languages in preference order; never infer country,
  /// wallet currency, or the assistant's conversational language from them.
  /// Unsupported UI languages fall back to English, without preventing users
  /// from speaking any language supported by the live model.
  static Locale resolve(Locale? deviceLocale, Iterable<Locale> supported) {
    if (deviceLocale == null) return const Locale('en');
    for (final locale in supported) {
      if (locale.languageCode == deviceLocale.languageCode) return locale;
    }
    return const Locale('en');
  }
}
