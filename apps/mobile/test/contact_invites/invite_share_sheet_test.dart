import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/contact_invites/invite_share.dart';
import 'package:masanawa/src/contact_invites/invite_share_sheet.dart';

class StubInviteTransport implements InviteLinkTransport {
  @override
  Future<InviteShareLink> createPersonalLink() async =>
    InviteShareLink.fromServer('https://masanawa.com/invite/v1.a.b.c');
}

class StubInviteShare implements InviteSystemShare {
  int calls = 0;
  @override
  Future<void> send(InviteShareLink link) async { calls++; }
}

void main() {
  testWidgets('explicit consented share works without Contacts permission', (tester) async {
    final sharing = StubInviteShare();
    final controller = InviteShareCoordinator(
      transport: StubInviteTransport(),
      sharing: sharing,
      currentSessionKey: () => null,
    );
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: InviteShareSheet(coordinator: controller)),
    ));
    expect(find.textContaining('We do not upload your phone contacts'), findsOneWidget);
    expect(find.text('Share my public profile invitation'), findsNothing);
    await tester.tap(find.text('Share invite'));
    await tester.pumpAndSettle();
    expect(sharing.calls, 1);
  });

  testWidgets('signed-out personal invitation fails closed with explanatory state',
      (tester) async {
    final sharing = StubInviteShare();
    final controller = InviteShareCoordinator(
      transport: StubInviteTransport(),
      sharing: sharing,
      currentSessionKey: () => null,
    );
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: InviteShareSheet(
        coordinator: controller, allowPersonal: true,
      )),
    ));
    await tester.tap(find.text('Share my public profile invitation'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Your account changed'), findsOneWidget);
    expect(sharing.calls, 0);
  });
}
