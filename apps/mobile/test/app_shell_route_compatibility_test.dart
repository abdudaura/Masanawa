import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/router/app_router.dart';
import 'package:masanawa/src/screens/twin/shell_tab.dart';

void main() {
  test('R17 routes only approved root tabs to indices', () {
    expect(shellRootTabIndex(null), 0);
    expect(shellRootTabIndex('chats'), 0);
    expect(shellRootTabIndex('status'), 1);
    expect(shellRootTabIndex('wallet'), 2);
    expect(shellRootTabIndex('calls'), 3);
    expect(shellRootTabIndex('rooms'), 4);
    expect(shellRootTabIndex('home'), 0);
    expect(shellRootTabIndex('agents'), 0);
    expect(shellRootTabIndex('talk'), 0);
  });

  test('R17 canonical route targets round-trip through tab parser', () {
    for (final tab in MasanawaRootTab.values) {
      final uri = Uri.parse(tab.location);
      final restored = MasanawaRootTab.fromQuery(
        uri.queryParameters['tab'],
      );
      expect(restored, tab);
      expect(uri.path, '/home');
      expect(shellRootTabIndex(uri.queryParameters['tab']), tab.index);
    }
    expect(MasanawaRootTab.fromQuery('create'), MasanawaRootTab.chats);
    expect(MasanawaRootTab.fromQuery('activity'), MasanawaRootTab.chats);
  });

  test('R17 old shell links retain their original destination', () {
    expect(legacyShellDestination('create'), '/talk/create');
    expect(legacyShellDestination('activity'), '/activity');
    expect(legacyShellDestination('agents'), '/home?tab=chats');
    expect(legacyShellDestination('wallet'), '/home?tab=wallet');
    expect(legacyShellDestination('talk'), '/home?tab=status');
    expect(legacyShellDestination('you'), isNull);
    expect(legacyShellDestination(null), isNull);
  });
}
