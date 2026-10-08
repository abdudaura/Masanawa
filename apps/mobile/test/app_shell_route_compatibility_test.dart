import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/router/app_router.dart';
import 'package:masanawa/src/screens/twin/shell_tab.dart';

void main() {
  test('R17/C08 canonical roots have five stable distinct identities', () {
    expect(MasanawaRootTab.values.map((tab) => tab.name).toList(),
        ['talks', 'chats', 'assistant', 'wallet', 'agents']);
    for (final tab in MasanawaRootTab.values) {
      expect(MasanawaRootTab.fromLocation(tab.location), tab);
    }
    expect(shellRootTabIndex(null), 0);
    expect(shellRootTabIndex('home'), 0);
    expect(shellRootTabIndex('talk'), 2);
    expect(shellRootTabIndex('wallet'), 3);
    expect(shellRootTabIndex('agents'), 4);
    expect(shellRootTabIndex('messages'), 1);
    // Historical /chats was an AI alias, never a person-to-person DM.
    expect(MasanawaRootTab.fromLocation('/chats'), MasanawaRootTab.assistant);
    expect(MasanawaRootTab.fromLocation('/chat'), MasanawaRootTab.assistant);
    expect(MasanawaRootTab.fromLocation('/chat/character_x'), isNull);
    expect(MasanawaRootTab.fromLocation('/messages/thread_x'), isNull);
  });

  test('legacy shell actions preserve destinations', () {
    expect(legacyShellDestination('create'), '/talk/create');
    expect(legacyShellDestination('activity'), '/activity');
    expect(legacyShellDestination('you'), '/you');
    expect(legacyShellDestination('agents'), isNull);
    expect(legacyShellDestination('wallet'), isNull);
    expect(legacyShellDestination('talk'), isNull);
  });
}

