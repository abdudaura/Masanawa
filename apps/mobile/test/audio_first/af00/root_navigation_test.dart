import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/router/app_router.dart';
import 'package:masanawa/src/screens/twin/shell_tab.dart';

void main() {
  test('AF00 confirmed navigation is identity-safe and ordered', () {
    expect(MasanawaRootTab.values, [
      MasanawaRootTab.chats,
      MasanawaRootTab.rooms,
      MasanawaRootTab.talks,
      MasanawaRootTab.gwani,
      MasanawaRootTab.wallet,
    ]);
    expect(MasanawaRootTab.talks.index, 2);
    expect(shellRootTabIndex(null), 2);
  });

  test('AF00 historic private AI selector is never a public audio post', () {
    expect(shellRootTabIndex('talk'), 3);
    expect(shellRootTabIndex('assistant'), 3);
    expect(shellRootTabIndex('gwani'), 3);
    expect(shellRootTabIndex('home'), 2);
    expect(shellRootTabIndex('talks'), 2);
  });

  test('AF00 historic new-chat directory remains separate from bottom tabs', () {
    expect(legacyShellDestination('agents'), '/agents');
    expect(legacyShellDestination('masana'), '/agents');
    expect(MasanawaRootTab.fromQuery('agents'), MasanawaRootTab.chats);
    expect(MasanawaRootTab.fromQuery('messages'), MasanawaRootTab.chats);
    expect(MasanawaRootTab.fromQuery('rooms'), MasanawaRootTab.rooms);
  });

  test('AF00 old actions preserve destinations, unknown queries fail to default', () {
    expect(legacyShellDestination('create'), '/talk/create');
    expect(legacyShellDestination('you'), '/you');
    expect(legacyShellDestination('activity'), '/activity');
    expect(legacyShellDestination('wallet'), isNull);
    expect(shellRootTabIndex('123'), MasanawaRootTab.talks.index);
  });

  test('AF00 deep-linkable tab locations always restore same semantic tab', () {
    for (final tab in MasanawaRootTab.values) {
      final uri = Uri.parse(tab.location);
      expect(uri.path, '/home');
      expect(MasanawaRootTab.fromQuery(uri.queryParameters['tab']), tab);
    }
    expect(MasanawaRootTab.talks.location, '/home');
    expect(MasanawaRootTab.gwani.location, '/home?tab=gwani');
  });
}
