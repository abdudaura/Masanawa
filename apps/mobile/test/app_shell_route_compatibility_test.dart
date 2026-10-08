import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/router/app_router.dart';
import 'package:masanawa/src/screens/twin/shell_tab.dart';

void main() {
  test('R17 routes only approved root tabs to indices', () {
    expect(shellRootTabIndex(null), 0);
    expect(shellRootTabIndex('home'), 0);
    expect(shellRootTabIndex('agents'), 1);
    expect(shellRootTabIndex('wallet'), 2);
    expect(shellRootTabIndex('talk'), 3);
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
    expect(MasanawaRootTab.fromQuery('create'), MasanawaRootTab.home);
    expect(MasanawaRootTab.fromQuery('activity'), MasanawaRootTab.home);
  });

  test('R17 old shell links retain their original destination', () {
    expect(legacyShellDestination('create'), '/talk/create');
    expect(legacyShellDestination('activity'), '/activity');
    expect(legacyShellDestination('you'), '/you');
    expect(legacyShellDestination('agents'), isNull);
    expect(legacyShellDestination('wallet'), isNull);
    expect(legacyShellDestination('talk'), isNull);
    expect(legacyShellDestination(null), isNull);
  });
}
