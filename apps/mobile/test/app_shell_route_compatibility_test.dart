import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/app/masanawa_consumer_shell.dart';
import 'package:masanawa/src/router/app_router.dart';

void main() {
  test('J02 canonical five-tab destinations are ordered with Home in centre', () {
    expect(MasanawaTab.values, [
      MasanawaTab.chats,
      MasanawaTab.rooms,
      MasanawaTab.home,
      MasanawaTab.gwani,
      MasanawaTab.wallet,
    ]);
    expect(shellRootTabIndex(null), MasanawaTab.home.index);
    expect(shellRootTabIndex('home'), 2);
    expect(shellRootTabIndex('chats'), 0);
    expect(shellRootTabIndex('rooms'), 1);
    expect(shellRootTabIndex('gwani'), 3);
    expect(shellRootTabIndex('wallet'), 4);
  });

  test('J02 routes round-trip without old Talk/Twin tab aliases', () {
    for (final tab in MasanawaTab.values) {
      final uri = Uri.parse(tab.location);
      expect(uri.path, '/home');
      expect(MasanawaTab.parse(uri.queryParameters['tab']), tab);
      expect(shellRootTabIndex(uri.queryParameters['tab']), tab.index);
    }
    expect(MasanawaTab.parse('talk'), MasanawaTab.home);
    expect(MasanawaTab.parse('agents'), MasanawaTab.home);
    expect(MasanawaTab.parse('twin'), MasanawaTab.home);
    expect(MasanawaTab.parse('create'), MasanawaTab.home);
  });

  test('J10 legacy create/activity requests never redirect into old product', () {
    expect(legacyShellDestination('create'), '/home');
    expect(legacyShellDestination('activity'), '/home');
    expect(legacyShellDestination('you'), '/account');
    expect(legacyShellDestination('talk'), isNull);
    expect(legacyShellDestination('agents'), isNull);
    expect(legacyShellDestination(null), isNull);
  });
}
