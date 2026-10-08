import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/contact_invites/invite_share.dart';

class FakeTransport implements InviteLinkTransport {
  FakeTransport(this.link);
  final InviteShareLink link;
  @override
  Future<InviteShareLink> createPersonalLink() async => link;
}

class FakeShare implements InviteSystemShare {
  final sent = <InviteShareLink>[];
  @override
  Future<void> send(InviteShareLink link) async { sent.add(link); }
}

void main() {
  const validToken = 'v1.YWJjZGVmMTIz.NOPQRST_123.NOPQRST_123';
  test('generic share is public, contains no phonebook material', () {
    final link = InviteShareLink.generic();
    expect(link.uri.toString(), 'https://masanawa.com/invite');
    expect(link.message, contains('https://masanawa.com/invite'));
    expect(link.personal, isFalse);
  });

  test('rejects forged origins, credentials, redirect fragments and query tricks', () {
    final bad = [
      'http://masanawa.com/invite/$validToken',
      'https://masanawa.com.evil.example/invite/$validToken',
      'https://user@masanawa.com/invite/$validToken',
      'https://masanawa.com:444/invite/$validToken',
      'https://masanawa.com/invite/$validToken?continue=https://evil.example',
      'https://masanawa.com/invite/$validToken#secret',
      'https://masanawa.com/talk/$validToken',
      'https://masanawa.com/invite/anything',
    ];
    for (final url in bad) {
      expect(() => InviteShareLink.fromServer(url), throwsFormatException, reason: url);
    }
    expect(InviteShareLink.fromServer(
      'https://masanawa.com/invite/$validToken',
    ).personal, isTrue);
  });

  test('sign-out or account switching fences late personal invitation delivery', () async {
    var session = 'tenant:A:accessA';
    final fake = FakeShare();
    final link = InviteShareLink.fromServer(
      'https://masanawa.com/invite/$validToken',
    );
    final coordinator = InviteShareCoordinator(
      transport: FakeTransport(link),
      sharing: fake,
      currentSessionKey: () => session,
    );
    await coordinator.sharePersonal();
    expect(fake.sent.single.personal, isTrue);
    fake.sent.clear();
    session = '';
    await expectLater(coordinator.sharePersonal(),
      throwsA(isA<InviteShareSessionChanged>()));
    expect(fake.sent, isEmpty);
    await coordinator.shareGeneric();
    expect(fake.sent.single.personal, isFalse);
  });
}
