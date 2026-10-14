import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import '../../l10n/app_localizations.dart';

/// UI locale is independent of the language spoken to an AI or wallet region.
/// Add translated application resources before claiming an entire locale is
/// translated. Flutter's stock Material/Cupertino labels are localized now.
abstract final class MasanawaLocalization {
  // Hausa app strings are translated; framework dialogs use English until
  // Flutter provides Hausa Material/Cupertino resources.
  static const supportedLocales = <Locale>[
    Locale('en'),
    Locale('ha'),
    Locale('ar'),
    Locale('fr'),
    Locale('es'),
    Locale('pt'),
  ];

  static const delegates = <LocalizationsDelegate<dynamic>>[
    AppLocalizations.delegate,
    _HausaMaterialDelegate(),
    _HausaCupertinoDelegate(),
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// Negotiate against every OS language in its declared preference order.
  /// UI language does not determine country, wallet currency or AI speech.
  static Locale resolvePreferred(
    Iterable<Locale>? deviceLocales,
    Iterable<Locale> supported,
  ) {
    final candidates = supported.toList(growable: false);
    for (final requested in deviceLocales ?? const <Locale>[]) {
      for (final available in candidates) {
        if (available.languageCode == requested.languageCode) {
          return available;
        }
      }
    }
    for (final available in candidates) {
      if (available.languageCode == 'en') return available;
    }
    return candidates.first;
  }

  static Locale resolve(Locale? deviceLocale, Iterable<Locale> supported) =>
      resolvePreferred(deviceLocale == null ? null : [deviceLocale], supported);
}

class _HausaMaterialDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const _HausaMaterialDelegate();
  @override
  bool isSupported(Locale locale) => locale.languageCode == 'ha';
  @override
  Future<MaterialLocalizations> load(Locale locale) =>
      GlobalMaterialLocalizations.delegate.load(const Locale('en'));
  @override
  bool shouldReload(_HausaMaterialDelegate old) => false;
}

class _HausaCupertinoDelegate
    extends LocalizationsDelegate<CupertinoLocalizations> {
  const _HausaCupertinoDelegate();
  @override
  bool isSupported(Locale locale) => locale.languageCode == 'ha';
  @override
  Future<CupertinoLocalizations> load(Locale locale) =>
      GlobalCupertinoLocalizations.delegate.load(const Locale('en'));
  @override
  bool shouldReload(_HausaCupertinoDelegate old) => false;
}
