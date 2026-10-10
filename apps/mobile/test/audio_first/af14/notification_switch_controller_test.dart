import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/account_preferences/notification_switch_controller.dart';

void main() {
  test('initial read is not a false optimistic enabled state', () async {
    final read = Completer<bool>();
    final controller = NotificationSwitchController(
      readEnabled: () => read.future,
      requestPermission: () async => true,
      unregister: () async {},
    );
    final pending = controller.bind('user_a');
    expect(controller.loading, true);
    expect(controller.enabled, false);
    expect(controller.canChange, false);
    read.complete(true);
    await pending;
    expect(controller.enabled, true);
    expect(controller.canChange, true);
    controller.dispose();
  });

  test('OS denial preserves disabled value and explains permission', () async {
    var reads = 0;
    final controller = NotificationSwitchController(
      readEnabled: () async { reads++; return false; },
      requestPermission: () async => false,
      unregister: () async {},
    );
    await controller.bind('user_a');
    expect(await controller.change(true), false);
    expect(controller.enabled, false);
    expect(controller.error, contains('device settings'));
    expect(reads, 1);
    controller.dispose();
  });

  test('a failed revoke never announces success or flips switch', () async {
    final controller = NotificationSwitchController(
      readEnabled: () async => true,
      requestPermission: () async => true,
      unregister: () async => throw StateError('offline'),
    );
    await controller.bind('user_a');
    expect(await controller.change(false), false);
    expect(controller.enabled, true);
    expect(controller.error, contains('Could not update'));
    controller.dispose();
  });

  test('stale read from previous account cannot populate new account', () async {
    final oldRead = Completer<bool>();
    var index = 0;
    final controller = NotificationSwitchController(
      readEnabled: () { index++; return index == 1 ? oldRead.future : Future.value(false); },
      requestPermission: () async => true,
      unregister: () async {},
    );
    final oldBinding = controller.bind('user_a');
    await controller.bind('user_b');
    oldRead.complete(true);
    await oldBinding;
    expect(controller.accountId, 'user_b');
    expect(controller.enabled, false);
    expect(controller.error, isNull);
    controller.dispose();
  });

  test('concurrent toggles issue only one permission request', () async {
    final pendingPermission = Completer<bool>();
    var enabled = false;
    var requests = 0;
    final controller = NotificationSwitchController(
      readEnabled: () async => enabled,
      requestPermission: () {
        requests++;
        return pendingPermission.future;
      },
      unregister: () async { enabled = false; },
    );
    await controller.bind('user_a');
    final first = controller.change(true);
    expect(controller.saving, true);
    expect(await controller.change(true), false);
    expect(requests, 1);
    enabled = true;
    pendingPermission.complete(true);
    expect(await first, true);
    expect(controller.enabled, true);
    controller.dispose();
  });

  test('permission granted but inactive registration is not success', () async {
    final controller = NotificationSwitchController(
      readEnabled: () async => false,
      requestPermission: () async => true,
      unregister: () async {},
    );
    await controller.bind('user_a');
    expect(await controller.change(true), false);
    expect(controller.enabled, false);
    expect(controller.error, contains('not confirmed'));
    controller.dispose();
  });

  test('account swap during pending write cannot update new UI state', () async {
    final permission = Completer<bool>();
    final controller = NotificationSwitchController(
      readEnabled: () async => false,
      requestPermission: () => permission.future,
      unregister: () async {},
    );
    await controller.bind('user_a');
    final oldWrite = controller.change(true);
    await controller.bind('user_b');
    permission.complete(true);
    expect(await oldWrite, false);
    expect(controller.accountId, 'user_b');
    expect(controller.enabled, false);
    expect(controller.saving, false);
    controller.dispose();
  });

  test('read failure is explicit, recoverable and never enables', () async {
    var fail = true;
    final controller = NotificationSwitchController(
      readEnabled: () async {
        if (fail) throw StateError('permission unavailable');
        return true;
      },
      requestPermission: () async => true,
      unregister: () async {},
    );
    await controller.bind('user_a');
    expect(controller.error, contains('Retry'));
    expect(controller.enabled, false);
    fail = false;
    await controller.refresh();
    expect(controller.error, isNull);
    expect(controller.enabled, true);
    controller.dispose();
  });
}
