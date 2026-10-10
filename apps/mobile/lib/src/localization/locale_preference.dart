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

/// A null locale delegates selection to Flutter's device language list.
/// Persisted choice never changes country, spoken language or currency.
final class LocalePreferenceController extends ChangeNotifier {
  LocalePreferenceController(this._store);

  final LocalePreferenceStore _store;
  Locale? _override;
  bool _loaded = false;
  bool _disposed = false;
  bool _saving = false;
  Future<void>? _pendingLoad;

  Locale? get override => _override;
  bool get loaded => _loaded;

  static Locale? validate(String? languageCode) {
    if (languageCode == null) return null;
    for (final locale in MasanawaLocalization.supportedLocales) {
      if (locale.languageCode == languageCode) return locale;
    }
    return null;
  }

  /// All callers share the same initialization task. A slow read cannot
  /// replace a newer selection; select() waits for initialization before
  /// changing storage. A late completion never notifies disposed listeners.
  Future<void> load() {
    if (_loaded || _disposed) return Future<void>.value();
    return _pendingLoad ??= _readSavedPreference();
  }

  Future<void> _readSavedPreference() async {
    String? saved;
    try {
      saved = await _store.read();
    } catch (_) {
      // A failed secure-storage read must not prevent sign-in or app startup.
      saved = null;
    }
    if (_disposed) return;
    _override = validate(saved);
    _loaded = true;
    notifyListeners();
  }

  /// Commit storage first. Concurrent selections are rejected rather than
  /// racing and silently persisting a different language from the visible UI.
  Future<void> select(Locale? locale) async {
    if (locale != null && validate(locale.languageCode) != locale) {
      throw ArgumentError.value(locale, 'locale', 'Unsupported UI locale');
    }
    await load();
    if (_disposed) throw StateError('Locale preferences are disposed');
    if (_saving) throw StateError('A language change is already in progress');
    _saving = true;
    try {
      await _store.write(locale?.languageCode);
      if (_disposed) return;
      _override = locale;
      _loaded = true;
      notifyListeners();
    } finally {
      _saving = false;
    }
  }

  // The public `override` preference getter shadows the annotation name.
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
