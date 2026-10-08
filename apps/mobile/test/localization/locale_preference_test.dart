import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/locale_preference.dart';

final class MemoryLocaleStore implements LocalePreferenceStore {
  MemoryLocaleStore([this.value]);
  String? value;
  bool fail = false;

  @override
  Future<String?> read() async {
    if (fail) throw StateError('read failed');
    return value;
  }

  @override
  Future<void> write(String? languageCode) async {
    if (fail) throw StateError('write failed');
    value = languageCode;
  }
}

void main() {
  test('restores supported locale and preserves restart semantics', () async {
    final store = MemoryLocaleStore();
    final first = LocalePreferenceController(store);
    await first.load();
    expect(first.override, isNull); // Follow device by default.
    await first.select(const Locale('ar'));
    expect(store.value, 'ar');
    expect(first.override, const Locale('ar'));
    final restarted = LocalePreferenceController(store);
    await restarted.load();
    expect(restarted.override, const Locale('ar'));
    await restarted.select(null);
    expect(store.value, isNull);
    expect(restarted.override, isNull);
    first.dispose();
    restarted.dispose();
  });

  test('unknown and corrupt settings safely follow the device', () async {
    final store = MemoryLocaleStore('xx');
    final controller = LocalePreferenceController(store);
    await controller.load();
    expect(controller.loaded, isTrue);
    expect(controller.override, isNull);
    controller.dispose();
    store.fail = true;
    final failed = LocalePreferenceController(store);
    await failed.load();
    expect(failed.override, isNull);
    failed.dispose();
  });

  test('write errors never produce unsaved UI language changes', () async {
    final store = MemoryLocaleStore('en');
    final controller = LocalePreferenceController(store);
    await controller.load();
    store.fail = true;
    await expectLater(
      controller.select(const Locale('fr')),
      throwsStateError,
    );
    expect(controller.override, const Locale('en'));
    expect(store.value, 'en');
    controller.dispose();
  });

  test('unsupported locale is rejected before storage changes', () async {
    final store = MemoryLocaleStore();
    final controller = LocalePreferenceController(store);
    await expectLater(
      controller.select(const Locale('de')),
      throwsArgumentError,
    );
    expect(store.value, isNull);
    controller.dispose();
  });
}
