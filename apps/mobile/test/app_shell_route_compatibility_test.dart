import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/router/app_router.dart';

void main() {
  test('R17 routes only approved root tabs to indices', () {
    expect(shellRootTabIndex(null), 0);
    expect(shellRootTabIndex('home'), 0);
    expect(shellRootTabIndex('agents'), 1);
    expect(shellRootTabIndex('wallet'), 2);
    expect(shellRootTabIndex('talk'), 3);
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
