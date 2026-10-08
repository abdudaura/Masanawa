import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_contacts_controller.dart';
import 'package:masanawa/src/messages/human_contacts_transport.dart';
import 'package:masanawa/src/messages/human_request_privacy_screen.dart';

const _prefs = HumanContactPreferences(
  policy: HumanContactPolicy.requests,
  discoverableByHandle: true,
);
const _incoming = HumanContact(
  userId: 'user_b', handle: 'bob', displayName: 'Bob',
  avatarUrl: null, status: HumanContactStatus.incoming,
  canMessage: false, requestRevision: '7',
);
const _outgoing = HumanContact(
  userId: 'user_c', handle: 'carol', displayName: 'Carol',
  avatarUrl: null, status: HumanContactStatus.outgoing,
  canMessage: false, requestRevision: '3',
);
const _accepted = HumanContact(
  userId: 'user_d', handle: 'dave', displayName: 'Dave',
  avatarUrl: null, status: HumanContactStatus.accepted,
  canMessage: false, requestRevision: '2',
);

Widget _content({
  required HumanContactsViewState state,
  Future<void> Function(HumanContact, bool)? respond,
  Future<void> Function(HumanContact)? withdraw,
  Future<void> Function(HumanContactPolicy)? policy,
  Future<void> Function(bool)? visibility,
  VoidCallback? refresh,
}) => MaterialApp(
  home: Scaffold(
    body: HumanRequestPrivacyContent(
      value: state,
      onRefresh: refresh ?? () {},
      onRespond: respond ?? (_, __) async {},
      onWithdraw: withdraw ?? (_) async {},
      onPolicy: policy ?? (_) async {},
      onDiscoverable: visibility ?? (_) async {},
    ),
  ),
);

void main() {
  testWidgets('incoming/outgoing are separate and exclude accepted persons',
      (tester) async {
    await tester.pumpWidget(_content(state: const HumanContactsViewState(
      loading: false,
      preferences: _prefs,
      contacts: [_incoming, _outgoing, _accepted],
    )));
    expect(find.text('Received requests (1 on this page)'), findsOneWidget);
    expect(find.text('Sent requests (1 on this page)'), findsOneWidget);
    expect(find.text('@bob'), findsOneWidget);
    expect(find.text('@carol'), findsOneWidget);
    expect(find.text('@dave'), findsNothing);
    expect(find.textContaining('not full inbox totals'), findsOneWidget);
  });

  testWidgets('accept uses current canonical target without fake chat',
      (tester) async {
    String? actor;
    bool? accepted;
    String? revision;
    await tester.pumpWidget(_content(
      state: const HumanContactsViewState(
        loading: false, preferences: _prefs, contacts: [_incoming],
      ),
      respond: (person, accept) async {
        actor = person.userId;
        accepted = accept;
        revision = person.requestRevision;
      },
    ));
    await tester.ensureVisible(find.byKey(const ValueKey('u24-accept-user_b')));
    await tester.tap(find.byKey(const ValueKey('u24-accept-user_b')));
    await tester.pump();
    expect(actor, 'user_b');
    expect(accepted, isTrue);
    expect(revision, '7');
    expect(find.text('Message'), findsNothing);
  });

  testWidgets('decline and withdraw are distinct deliberate operations',
      (tester) async {
    bool? accepted;
    String? withdrawn;
    await tester.pumpWidget(_content(
      state: const HumanContactsViewState(
        loading: false, preferences: _prefs, contacts: [_incoming, _outgoing],
      ),
      respond: (_, action) async { accepted = action; },
      withdraw: (person) async { withdrawn = person.userId; },
    ));
    await tester.ensureVisible(find.byKey(const ValueKey('u24-decline-user_b')));
    await tester.tap(find.byKey(const ValueKey('u24-decline-user_b')));
    await tester.pump();
    expect(accepted, isFalse);
    await tester.ensureVisible(find.byKey(const ValueKey('u24-withdraw-user_c')));
    await tester.tap(find.byKey(const ValueKey('u24-withdraw-user_c')));
    await tester.pump();
    expect(withdrawn, 'user_c');
  });

  testWidgets('busy disables sensitive contact mutations and privacy edits',
      (tester) async {
    await tester.pumpWidget(_content(
      state: const HumanContactsViewState(
        loading: false, busy: true,
        preferences: _prefs, contacts: [_incoming, _outgoing],
      ),
    ));
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('u24-accept-user_b'))).onPressed,
      isNull,
    );
    expect(
      tester.widget<OutlinedButton>(
        find.byKey(const ValueKey('u24-withdraw-user_c'))).onPressed,
      isNull,
    );
    expect(
      tester.widget<SwitchListTile>(
        find.byKey(const ValueKey('u24-handle-visibility'))).onChanged,
      isNull,
    );
  });

  testWidgets('missing server revision cannot accept or decline',
      (tester) async {
    const missingRevision = HumanContact(
      userId: 'user_x', handle: 'extra', displayName: 'Extra',
      avatarUrl: null, status: HumanContactStatus.incoming,
      canMessage: false, requestRevision: null,
    );
    await tester.pumpWidget(_content(
      state: const HumanContactsViewState(
        loading: false, preferences: _prefs, contacts: [missingRevision],
      ),
    ));
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('u24-accept-user_x'))).onPressed,
      isNull,
    );
    expect(
      tester.widget<OutlinedButton>(
        find.byKey(const ValueKey('u24-decline-user_x'))).onPressed,
      isNull,
    );
  });

  testWidgets('privacy policy and discoverability call existing C01 actions',
      (tester) async {
    HumanContactPolicy? chosen;
    bool? discoverable;
    await tester.pumpWidget(_content(
      state: const HumanContactsViewState(
        loading: false, preferences: _prefs,
      ),
      policy: (next) async { chosen = next; },
      visibility: (next) async { discoverable = next; },
    ));
    await tester.tap(find.text('Ask before messaging'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('No new contact requests').last);
    await tester.pump();
    expect(chosen, HumanContactPolicy.nobody);
    await tester.tap(find.byKey(const ValueKey('u24-handle-visibility')));
    await tester.pump();
    expect(discoverable, isFalse);
  });

  testWidgets('transport failure never displays action success and can retry',
      (tester) async {
    var retries = 0;
    await tester.pumpWidget(_content(
      state: const HumanContactsViewState(
        loading: false, preferences: _prefs, error: 'Network unavailable',
      ),
      refresh: () => retries++,
    ));
    expect(find.text('Network unavailable'), findsOneWidget);
    expect(find.text('Contact request accepted.'), findsNothing);
    await tester.ensureVisible(find.text('Retry'));
    await tester.tap(find.text('Retry'));
    expect(retries, 1);
  });
}
