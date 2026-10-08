import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'masanawa_localization.dart';

/// The selected UI language is a device preference. It does not set the
/// spoken assistant language, location, country, or payment currency.
abstract interface class LocalePreferenceStore {
  Future<String?> read();
  Future<void> write(String? languageCode);
}

final class SecureLocalePreferenceStore implements LocalePreferenceStore {
  SecureLocalePreferenceStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const key = 'masanawa.ui_language.v1';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: key);

  @override
  Future<void> write(String? languageCode) async {
    if (languageCode == null) {
      await _storage.delete(key: key);
    } else {
      await _storage.write(key: key, value: languageCode);
    }
  }
}

/// A null locale delegates selection to Flutter's device-locale resolution.
/// Changes are applied to the running MaterialApp without a router rebuild.
final class LocalePreferenceController extends ChangeNotifier {
  LocalePreferenceController(this._store);

  final LocalePreferenceStore _store;
  Locale? _override;
  bool _loaded = false;

  Locale? get override => _override;
  bool get loaded => _loaded;

  static Locale? validate(String? languageCode) {
    if (languageCode == null) return null;
    for (final locale in MasanawaLocalization.supportedLocales) {
      if (locale.languageCode == languageCode) return locale;
    }
    return null;
  }

  Future<void> load() async {
    if (_loaded) return;
    try {
      _override = validate(await _store.read());
    } catch (_) {
      // Broken or temporarily unavailable secure storage must not prevent
      // app startup. A subsequent explicit selection can retry the write.
      _override = null;
    }
    _loaded = true;
    notifyListeners();
  }

  /// Persist before updating the UI; a failed save must not display a
  /// language selection that will disappear silently on restart.
  Future<void> select(Locale? locale) async {
    if (locale != null && validate(locale.languageCode) != locale) {
      throw ArgumentError.value(locale, 'locale', 'Unsupported UI locale');
    }
    await _store.write(locale?.languageCode);
    _override = locale;
    _loaded = true;
    notifyListeners();
  }
}
