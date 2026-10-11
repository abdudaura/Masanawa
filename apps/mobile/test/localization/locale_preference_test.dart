import 'dart:async';

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


final class DeferredLocaleStore implements LocalePreferenceStore {
  final readGate = Completer<String?>();
  final writeGate = Completer<void>();
  String? saved;

  @override
  Future<String?> read() => readGate.future;

  @override
  Future<void> write(String? languageCode) async {
    await writeGate.future;
    saved = languageCode;
  }
}

void main() {
  test('restores supported locale and preserves restart semantics', () async {
    final store = MemoryLocaleStore();
    final first = LocalePreferenceController(store);
    await first.load();
    expect(first.localeOverride, isNull); // Follow device by default.
    await first.select(const Locale('ar'));
    expect(store.value, 'ar');
    expect(first.localeOverride, const Locale('ar'));
    final restarted = LocalePreferenceController(store);
    await restarted.load();
    expect(restarted.localeOverride, const Locale('ar'));
    await restarted.select(null);
    expect(store.value, isNull);
    expect(restarted.localeOverride, isNull);
    first.dispose();
    restarted.dispose();
  });

  test('unknown and corrupt settings safely follow the device', () async {
    final store = MemoryLocaleStore('xx');
    final controller = LocalePreferenceController(store);
    await controller.load();
    expect(controller.loaded, isTrue);
    expect(controller.localeOverride, isNull);
    controller.dispose();
    store.fail = true;
    final failed = LocalePreferenceController(store);
    await failed.load();
    expect(failed.localeOverride, isNull);
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
    expect(controller.localeOverride, const Locale('en'));
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
  test('selection never races a slow storage restoration', () async {
    final store = DeferredLocaleStore();
    final controller = LocalePreferenceController(store);
    final reading = controller.load();
    final selecting = controller.select(const Locale('fr'));
    store.readGate.complete('ar');
    await reading;
    expect(controller.localeOverride, const Locale('ar'));
    store.writeGate.complete();
    await selecting;
    expect(controller.localeOverride, const Locale('fr'));
    expect(store.saved, 'fr');
    controller.dispose();
  });

  test('no notifications after widget disposes while locale read is pending', () async {
    final store = DeferredLocaleStore();
    final controller = LocalePreferenceController(store);
    var notices = 0;
    controller.addListener(() => notices++);
    final pending = controller.load();
    controller.dispose();
    store.readGate.complete('ar');
    await pending;
    expect(notices, 0);
  });

  test('second parallel language save rejects rather than racing writes', () async {
    final store = DeferredLocaleStore();
    store.readGate.complete(null);
    final controller = LocalePreferenceController(store);
    await controller.load();
    final first = controller.select(const Locale('fr'));
    await Future<void>.delayed(Duration.zero);
    await expectLater(
      controller.select(const Locale('ar')),
      throwsStateError,
    );
    store.writeGate.complete();
    await first;
    expect(controller.localeOverride, const Locale('fr'));
    expect(store.saved, 'fr');
    controller.dispose();
  });

}
