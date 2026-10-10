import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/chat/chat_list_screen.dart';
import 'package:masanawa/src/state/session_state.dart';

SessionSignedIn signedIn(String userId, {String token = 'access'}) {
  final user = AuthUser(
    id: userId,
    name: 'Test User',
    locale: 'en',
    status: 'ACTIVE',
    role: 'customer',
    isNewUser: false,
    createdAt: '2026-10-10T00:00:00.000Z',
  );
  return SessionSignedIn(
    user,
    AuthTokens(
      accessToken: token,
      refreshToken: 'refresh',
      accessExpiresIn: 900,
      user: user,
    ),
  );
}

void main() {
  test('accepts delayed actions after tokens rotate for the same user', () {
    final initial = signedIn('user-a');
    final refreshed = signedIn('user-a', token: 'rotated');
    expect(chatActionBelongsToSession(initial, refreshed), isTrue);
  });

  test('rejects delayed delete/rename after account switch', () {
    final initial = signedIn('user-a');
    expect(chatActionBelongsToSession(initial, signedIn('user-b')), isFalse);
    expect(
      chatActionBelongsToSession(initial, const SessionSignedOut()),
      isFalse,
    );
    expect(
      chatActionBelongsToSession(initial, const SessionRestoring()),
      isFalse,
    );
  });

  test('does not mistake unauthenticated transitional states for an owner', () {
    const initial = SessionRestoring();
    expect(chatActionBelongsToSession(initial, signedIn('user-a')), isFalse);
    expect(
      chatActionBelongsToSession(initial, const SessionSignedOut()),
      isFalse,
    );
  });
}
