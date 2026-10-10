import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/profile/edit_profile_screen.dart';
import 'package:masanawa/src/social/own_profile_transport.dart';
import 'package:masanawa/src/social/talk_social_profiles.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'user_viewer',
  name: 'Amina',
  email: 'amina@example.test',
  locale: 'en',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const _tokens = AuthTokens(
  accessToken: 'test',
  refreshToken: 'refresh',
  accessExpiresIn: 900,
  user: _user,
);

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);
}

class _FakeProfile implements OwnProfileTransport {
  _FakeProfile({this.exists = true});
  bool exists;
  String savedName = 'Amina';
  String savedBio = 'Old bio';
  String savedHandle = 'amina';
  bool failNextUpdate = false;
  int updates = 0;
  int creates = 0;
  String? lastName;
  String? lastBio;

  HumanProfile _profile({
    String name = 'Amina',
    String bio = 'Old bio',
    String handle = 'amina',
  }) => HumanProfile(
    handle: handle,
    displayName: name,
    bio: bio,
    followerCount: 0,
    followingCount: 0,
    isFollowing: false,
  );

  @override
  Future<HumanProfile> loadSelf() async {
    if (!exists) {
      final options = RequestOptions(path: '/profiles/me');
      throw DioException(
        requestOptions: options,
        response: Response<dynamic>(
          requestOptions: options, statusCode: 404,
        ),
      );
    }
    return _profile(
      name: savedName, bio: savedBio, handle: savedHandle,
    );
  }

  @override
  Future<HumanProfile> createSelf({
    required String handle,
    required String displayName,
    required String bio,
  }) async {
    creates += 1;
    exists = true;
    lastName = displayName;
    lastBio = bio;
    savedHandle = handle;
    savedName = displayName;
    savedBio = bio;
    return _profile(handle: handle, name: displayName, bio: bio);
  }

  @override
  Future<HumanProfile> updateSelf({
    String? displayName,
    String? bio,
    bool removeAvatar = false,
  }) async {
    updates += 1;
    if (failNextUpdate) {
      failNextUpdate = false;
      throw StateError('Simulated server outage');
    }
    lastName = displayName;
    lastBio = bio;
    savedName = displayName ?? savedName;
    savedBio = bio ?? savedBio;
    return _profile(name: savedName, bio: savedBio, handle: savedHandle);
  }
}

Widget _app(_FakeProfile profile) => ProviderScope(
  overrides: [
    ownProfileTransportProvider.overrideWithValue(profile),
    sessionProvider.overrideWith(_Session.new),
  ],
  child: MaterialApp(
    theme: buildMasanawaTheme(brightness: Brightness.light),
    home: const EditProfileScreen(),
  ),
);

void main() {
  testWidgets('editing existing profile persists through authenticated API',
      (tester) async {
    final transport = _FakeProfile();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    expect(find.text('@amina'), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-create-handle')), findsNothing);
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Amina Bello',
    );
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-bio')), 'Community host',
    );
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();

    expect(transport.updates, 1);
    expect(transport.lastName, 'Amina Bello');
    expect(transport.lastBio, 'Community host');
    expect(find.text('Amina Bello'), findsWidgets);
  });

  testWidgets('missing profile offers real first-time creation', (tester) async {
    final transport = _FakeProfile(exists: false);
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    expect(find.text('Create profile'), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('profile-create-handle')), 'amina_2026',
    );
    // Creation becomes actionable only after the form rebuilds.
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();

    expect(transport.creates, 1);
    expect(transport.updates, 0);
    expect(find.text('@amina_2026'), findsOneWidget);
  });

  testWidgets('unsaved or invalid updates cannot be submitted', (tester) async {
    final transport = _FakeProfile();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('profile-edit-save')),
      ).onPressed,
      isNull,
    );

    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), ' ',
    );
    // Allow onChanged/setState to rebuild the action before tapping it.
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.updates, 0);
    expect(find.text('Enter at least two characters'), findsOneWidget);
  });
  testWidgets('saved public profile survives leaving and reopening editor',
      (tester) async {
    final transport = _FakeProfile();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Amina Bello',
    );
    // Rebuild the enabled Save action after editing the field.
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.savedName, 'Amina Bello');

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(
        find.byKey(const ValueKey('profile-edit-name')),
      ).controller?.text,
      'Amina Bello',
    );
  });

  testWidgets('failed save keeps previous server state for recovery',
      (tester) async {
    final transport = _FakeProfile()..failNextUpdate = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Amina Bello',
    );
    // Rebuild the enabled Save action after editing the field.
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.savedName, 'Amina');
    expect(find.textContaining('Could not confirm whether your changes saved'), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-reload')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.savedName, 'Amina Bello');
  });

}
