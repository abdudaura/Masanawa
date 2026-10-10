import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/router/app_router.dart';
import 'package:masanawa/src/screens/twin/shell_tab.dart';

void main() {
  test('AF00 named five-tab order and centre Talks default', () {
    expect(MasanawaRootTab.values.map((t) => t.queryValue).toList(),
      ['chats', 'rooms', 'talks', 'gwani', 'wallet']);
    expect(shellRootTabIndex(null), 2);
    expect(shellRootTabIndex('talks'), 2);
    expect(shellRootTabIndex('rooms'), 1);
    expect(shellRootTabIndex('chats'), 0);
    expect(shellRootTabIndex('gwani'), 3);
    expect(shellRootTabIndex('wallet'), 4);
  });

  test('AF00 canonical routes round-trip without saving unstable indices', () {
    for (final tab in MasanawaRootTab.values) {
      final uri = Uri.parse(tab.location);
      expect(uri.path, '/home');
      expect(MasanawaRootTab.fromQuery(uri.queryParameters['tab']), tab);
      expect(shellRootTabIndex(uri.queryParameters['tab']), tab.index);
    }
    expect(MasanawaRootTab.talks.location, '/home');
  });

  test('AF00 old private talk never becomes the public Talks feed', () {
    expect(MasanawaRootTab.fromQuery('talk'), MasanawaRootTab.gwani);
    expect(MasanawaRootTab.fromQuery('assistant'), MasanawaRootTab.gwani);
    expect(MasanawaRootTab.fromQuery('home'), MasanawaRootTab.talks);
    expect(MasanawaRootTab.fromQuery('agents'), MasanawaRootTab.chats);
    expect(MasanawaRootTab.fromQuery('masana'), MasanawaRootTab.chats);
    expect(MasanawaRootTab.fromQuery('messages'), MasanawaRootTab.chats);
    expect(MasanawaRootTab.fromQuery('unknown'), MasanawaRootTab.talks);
    expect(MasanawaRootTab.fromQuery('create'), MasanawaRootTab.talks);
    expect(MasanawaRootTab.fromQuery('activity'), MasanawaRootTab.talks);
  });

  test('AF00 old shell action deep links retain exact actions', () {
    expect(legacyShellDestination('create'), '/talk/create');
    expect(legacyShellDestination('activity'), '/activity');
    expect(legacyShellDestination('you'), '/you');
    expect(legacyShellDestination('agents'), '/agents');
    expect(legacyShellDestination('masana'), '/agents');
    expect(legacyShellDestination('wallet'), isNull);
    expect(legacyShellDestination('talk'), isNull);
    expect(legacyShellDestination(null), isNull);
  });
}
