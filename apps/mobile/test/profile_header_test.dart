import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/social/profile_header.dart';

void main() {
  test('prefers the persisted public display name and HTTPS avatar', () {
    final profile = resolveProfileHeader(
      sessionName: 'Session Name',
      publicDisplayName: ' Public Name ',
      publicAvatarUrl: ' https://cdn.example.com/avatars/profile.webp?revision=2 ',
    );
    expect(profile.displayName, 'Public Name');
    expect(profile.initial, 'P');
    expect(profile.avatarUrl,
        'https://cdn.example.com/avatars/profile.webp?revision=2');
  });

  test('missing, pending, or failed public profile keeps session identity', () {
    for (final savedName in [null, '', '  ']) {
      final profile = resolveProfileHeader(
        sessionName: ' Gwani Customer ',
        publicDisplayName: savedName,
      );
      expect(profile.displayName, 'Gwani Customer');
      expect(profile.initial, 'G');
      expect(profile.avatarUrl, isNull);
    }
  });

  test('never invents a visible name if signed-in identity is empty', () {
    final profile = resolveProfileHeader(sessionName: ' ');
    expect(profile.displayName, '');
    expect(profile.initial, 'U');
  });

  test('rejects non-HTTPS, malformed and credential-bearing avatar sources', () {
    for (final raw in [
      'http://cdn.example.com/avatar.png',
      'file:///private/avatar.png',
      'data:image/svg+xml;base64,SGVsbG8=',
      'https://user:secret@cdn.example.com/avatar.png',
      'https:avatar.png',
      '/relative/avatar.png',
      'javascript:alert(1)',
      '   ',
    ]) {
      expect(resolveProfileHeader(
        sessionName: 'A', publicAvatarUrl: raw,
      ).avatarUrl, isNull, reason: raw);
    }
  });

  test('preserves Unicode first rune for initials', () {
    final profile = resolveProfileHeader(
      sessionName: 'Name', publicDisplayName: '😀 Example',
    );
    expect(profile.initial, '😀');
  });
}
