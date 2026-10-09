import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/screens/profile/human_profile_safety_sheet.dart';
import 'package:masanawa/src/screens/profile/person_profile_screen.dart';
import 'package:masanawa/src/social/human_profile_safety_transport.dart';
import 'package:masanawa/src/social/talk_social_profiles.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/talk_social_profile_state.dart';
import 'package:masanawa/src/talks/talk_safety.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'viewer-a', name: 'Viewer', email: 'viewer@example.test',
  locale: 'en', status: 'ACTIVE', role: 'USER', isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const _tokens = AuthTokens(
  accessToken: 'test-access-token', refreshToken: 'test-refresh-token',
  accessExpiresIn: 900, user: _user,
);
class _SignedIn extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);
  void signOutForTest() => state = const SessionSignedOut();
}

class _Safety implements HumanProfileSafetyTransport {
  TalkSafetyPreference current = const TalkSafetyPreference(
    blocked: false, muted: false,
  );
  bool failAfterCommit = false;
  bool failRead = false;
  int reads = 0;
  int writes = 0;
  String? seenHandle;

  @override
  Future<TalkSafetyPreference> load(String handle) async {
    reads++;
    seenHandle = handle;
    if (failRead) throw StateError('Network offline');
    return current;
  }

  @override
  Future<TalkSafetyPreference> update({
    required String handle,
    required bool blocked,
    required bool muted,
  }) async {
    writes++;
    seenHandle = handle;
    current = TalkSafetyPreference(blocked: blocked, muted: muted);
    if (failAfterCommit) {
      failAfterCommit = false;
      throw StateError('Server saved but response lost');
    }
    return current;
  }
}

class _Profiles implements TalkSocialProfileTransport {
  @override
  Future<HumanProfile?> loadHuman(String handle) async => const HumanProfile(
    handle: 'amina', displayName: 'Amina', followerCount: 0,
    followingCount: 0, isFollowing: false,
  );
  @override
  Future<HumanProfile?> loadHumanByUserId(String id) async => null;
  @override
  Future<PersonaProfile?> loadPersona(String publicId) async => null;
  @override
  Future<HumanProfile> setFollowing({
    required String handle, required bool following,
  }) async => throw UnimplementedError();
  @override
  Future<HumanProfile> setFollowingUserId({
    required String userId, required bool following,
  }) async => throw UnimplementedError();
}

Widget _app(_Safety transport, {Widget? home}) => ProviderScope(
  overrides: [
    humanProfileSafetyTransportProvider.overrideWithValue(transport),
    sessionProvider.overrideWith(_SignedIn.new),
    talkSocialProfileTransportProvider.overrideWithValue(_Profiles()),
  ],
  child: MaterialApp(
    theme: buildMasanawaTheme(brightness: Brightness.light),
    home: Scaffold(
      body: home ?? const HumanProfileSafetySheet(
        handle: 'amina', displayName: 'Amina',
      ),
    ),
  ),
);

void main() {
  testWidgets('loads and readbacks both preference switches before success',
      (tester) async {
    final server = _Safety();
    await tester.pumpWidget(_app(server));
    await tester.pumpAndSettle();
    expect(server.reads, 1);
    expect(tester.widget<SwitchListTile>(
      find.byKey(const ValueKey('human-safety-block')),
    ).value, false);
    await tester.tap(find.byKey(const ValueKey('human-safety-block')));
    await tester.pumpAndSettle();
    expect(server.writes, 1);
    expect(server.reads, 2);
    expect(server.seenHandle, 'amina');
    expect(server.current.blocked, true);
    expect(server.current.muted, false);
    expect(find.text('Privacy preference saved.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('human-safety-mute')));
    await tester.pumpAndSettle();
    expect(server.current.blocked, true);
    expect(server.current.muted, true);
    expect(server.reads, 3);
  });

  testWidgets('uncertain PUT disables editing until authoritative refresh',
      (tester) async {
    final server = _Safety()..failAfterCommit = true;
    await tester.pumpWidget(_app(server));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('human-safety-block')));
    await tester.pumpAndSettle();
    expect(server.current.blocked, true); // COMMITTED on the server
    expect(server.writes, 1);
    final disabled = tester.widget<SwitchListTile>(
      find.byKey(const ValueKey('human-safety-mute')),
    );
    expect(disabled.onChanged, isNull);
    expect(find.textContaining('may have applied'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('human-safety-refresh')));
    await tester.pumpAndSettle();
    expect(server.reads, 2);
    expect(tester.widget<SwitchListTile>(
      find.byKey(const ValueKey('human-safety-block')),
    ).value, true);
    expect(server.writes, 1); // no duplicate uncertain PUT
  });

  testWidgets('public human profile opens real controls', (tester) async {
    final server = _Safety();
    await tester.pumpWidget(
      _app(server, home: const PersonProfileScreen(handle: 'amina')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('human-profile-safety-open')));
    await tester.pumpAndSettle();
    expect(find.text('Privacy · Amina'), findsOneWidget);
    expect(server.reads, 1);
  });

  testWidgets('sign-out fences old-account safety switches', (tester) async {
    final server = _Safety();
    await tester.pumpWidget(_app(server));
    await tester.pumpAndSettle();
    final scope = ProviderScope.containerOf(
      tester.element(find.byType(HumanProfileSafetySheet)),
    );
    (scope.read(sessionProvider.notifier) as _SignedIn).signOutForTest();
    await tester.pumpAndSettle();
    final blocked = tester.widget<SwitchListTile>(
      find.byKey(const ValueKey('human-safety-block')),
    );
    expect(blocked.onChanged, isNull);
    expect(tester.widget<OutlinedButton>(
      find.byKey(const ValueKey('human-safety-refresh')),
    ).onPressed, isNull);
    expect(server.writes, 0);
  });

  test('authenticated HTTP preserves tenant-authorized handle and exact states',
      () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    final api = ApiClient(dio: dio)..accessToken = 'viewer-session-token';
    final seen = <RequestOptions>[];
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        seen.add(options);
        handler.resolve(Response<dynamic>(
          requestOptions: options,
          statusCode: 200,
          data: {
            'blocked': options.method == 'PUT', 'muted': false,
          },
        ));
      },
    ));
    final transport = GatewayHumanProfileSafetyTransport(api);
    final before = await transport.load('@Amina');
    expect(before.blocked, false);
    final after = await transport.update(
      handle: '@Amina', blocked: true, muted: false,
    );
    expect(after.blocked, true);
    expect(seen.map((entry) => entry.path).toList(), [
      '/safety/profiles/amina/preference',
      '/safety/profiles/amina/preference',
    ]);
    expect(seen[0].headers['Authorization'], 'Bearer viewer-session-token');
    expect(seen[1].data, {'blocked': true, 'muted': false});
    await expectLater(transport.load('../admin'), throwsFormatException);
  });
}
