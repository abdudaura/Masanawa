import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/account/privacy_settings_repository.dart';
import 'package:masanawa/src/features/account/privacy_settings_screen.dart';

class MemoryPreferences implements DeliverySettingsRepository {
  bool fail = false;
  int saves = 0;
  final Map<String,bool> values = {for (final kind in deliveryPreferenceKinds) kind: false};
  @override
  Future<List<DeliveryPreference>> load() async {
    if (fail) throw StateError('offline');
    return [for (final kind in deliveryPreferenceKinds) DeliveryPreference(kind, values[kind]!)];
  }
  @override
  Future<DeliveryPreference> update(String kind, bool enabled) async {
    saves++;
    if (fail) throw StateError('offline');
    values[kind] = enabled;
    return DeliveryPreference(kind, enabled);
  }
}
void main() {
  testWidgets('C06 shows verified settings and persists a switch', (tester) async {
    final repo = MemoryPreferences();
    await tester.pumpWidget(MaterialApp(home: PrivacySettingsScreen(repository: repo, accountKey: 'fan_1')));
    await tester.pumpAndSettle();
    expect(find.text('Optional push notifications'), findsOneWidget);
    final toggle = find.byKey(const Key('delivery-room_answer'));
    await tester.ensureVisible(toggle);
    await tester.tap(toggle);
    await tester.pumpAndSettle();
    expect(repo.values['room_answer'], isTrue);
    expect(repo.saves, 1);
  });
  testWidgets('C06 fails safely offline and can retry', (tester) async {
    final repo = MemoryPreferences()..fail = true;
    await tester.pumpWidget(MaterialApp(home: PrivacySettingsScreen(repository: repo, accountKey: 'fan_1')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Preferences unavailable'), findsOneWidget);
    repo.fail = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('delivery-wallet')), findsOneWidget);
  });
  testWidgets('C06 signed-out account never writes choices', (tester) async {
    final repo = MemoryPreferences();
    await tester.pumpWidget(MaterialApp(home: PrivacySettingsScreen(repository: repo, accountKey: '')));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to choose notifications'), findsOneWidget);
    expect(repo.saves, 0);
  });
  testWidgets('C06 account switch clears prior choices', (tester) async {
    final repo = MemoryPreferences();
    await tester.pumpWidget(MaterialApp(home: PrivacySettingsScreen(repository: repo, accountKey: 'fan_1')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('delivery-wallet')), findsOneWidget);
    await tester.pumpWidget(MaterialApp(home: PrivacySettingsScreen(repository: repo, accountKey: '')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('delivery-wallet')), findsNothing);
  });
}
