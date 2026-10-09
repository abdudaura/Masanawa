import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/profile/edit_profile_screen.dart';
import 'package:masanawa/src/profile_avatar/avatar_transport.dart';
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

const _otherUser = AuthUser(
  id: 'user_second',
  name: 'Bello',
  email: 'bello@example.test',
  locale: 'en',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const _otherTokens = AuthTokens(
  accessToken: 'second-test',
  refreshToken: 'second-refresh',
  accessExpiresIn: 900,
  user: _otherUser,
);

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);

  void become(SessionState next) => state = next;
}

class _FakeProfile implements OwnProfileTransport {
  _FakeProfile({this.exists = true});
  bool exists;
  String savedName = 'Amina';
  String savedBio = 'Old bio';
  String savedHandle = 'amina';
  bool failNextUpdate = false;
  bool failNextLoad = false;
  bool failAfterServerSave = false;
  bool failAfterCreate = false;
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
    if (failNextLoad) {
      failNextLoad = false;
      throw StateError('Simulated profile read failure');
    }
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
    if (failAfterCreate) {
      failAfterCreate = false;
      throw StateError('Response lost after profile was created');
    }
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
    if (failAfterServerSave) {
      failAfterServerSave = false;
      throw StateError('Response lost after profile was committed');
    }
    return _profile(name: savedName, bio: savedBio, handle: savedHandle);
  }
}

class _PendingLoads extends _FakeProfile {
  final first = Completer<HumanProfile>();
  final second = Completer<HumanProfile>();
  int calls = 0;

  @override
  Future<HumanProfile> loadSelf() {
    calls++;
    if (calls == 1) return first.future;
    if (calls == 2) return second.future;
    return super.loadSelf();
  }
}

class _PendingSave extends _FakeProfile {
  final completion = Completer<HumanProfile>();

  @override
  Future<HumanProfile> updateSelf({
    String? displayName,
    String? bio,
    bool removeAvatar = false,
  }) {
    updates++;
    return completion.future;
  }
}

class _FakeAvatar implements ProfileAvatarTransport {
  int uploads = 0;
  int removals = 0;
  @override
  Future<String> upload(Uint8List png, {required String? expectedUrl}) async {
    uploads++;
    return 'https://images.example.test/avatar.png';
  }
  @override
  Future<void> remove({required String expectedUrl}) async {
    removals++;
  }
}

Widget _app(_FakeProfile profile, {_FakeAvatar? avatar}) => ProviderScope(
  overrides: [
    ownProfileTransportProvider.overrideWithValue(profile),
    if (avatar != null) profileAvatarTransportProvider.overrideWithValue(avatar),
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
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
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
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
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
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
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
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
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
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.savedName, 'Amina');
    expect(find.textContaining('Could not confirm whether your changes saved'), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-reload')), findsOneWidget);

    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('profile-edit-save')),
      ).onPressed,
      isNull,
    );
    // A second tap must not issue another PATCH before a confirming GET.
    expect(transport.updates, 1);
    await tester.tap(find.byKey(const ValueKey('profile-reload')));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(
        find.byKey(const ValueKey('profile-edit-name')),
      ).controller?.text,
      'Amina',
    );
    expect(transport.savedName, 'Amina');
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Amina Bello',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.updates, 2);
    expect(transport.savedName, 'Amina Bello');
  });

  testWidgets('committed but unacknowledged profile save is not replayed',
      (tester) async {
    final transport = _FakeProfile()..failAfterServerSave = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Already committed',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();

    expect(transport.updates, 1);
    expect(transport.savedName, 'Already committed');
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('profile-edit-save')),
      ).onPressed,
      isNull,
    );
    await tester.tap(find.byKey(const ValueKey('profile-reload')));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(
        find.byKey(const ValueKey('profile-edit-name')),
      ).controller!.text,
      'Already committed',
    );
    expect(transport.updates, 1);
    expect(find.textContaining('Could not confirm whether'), findsNothing);
  });

  testWidgets('lost create response reconciles without duplicate profile creation',
      (tester) async {
    final transport = _FakeProfile(exists: false)..failAfterCreate = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-create-handle')), 'new_amina',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();

    expect(transport.creates, 1);
    expect(transport.exists, isTrue);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('profile-edit-save')),
      ).onPressed,
      isNull,
    );
    await tester.tap(find.byKey(const ValueKey('profile-reload')));
    await tester.pumpAndSettle();
    expect(find.text('@new_amina'), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-create-handle')), findsNothing);
    expect(transport.creates, 1);
  });

  testWidgets('failed readback retains lock until a successful authenticated GET',
      (tester) async {
    final transport = _FakeProfile()..failNextUpdate = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-bio')), 'Unsure bio',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();

    transport.failNextLoad = true;
    await tester.tap(find.byKey(const ValueKey('profile-reload')));
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('profile-edit-save')),
      ).onPressed,
      isNull,
    );
    expect(transport.updates, 1);
    await tester.tap(find.byKey(const ValueKey('profile-reload')));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(
        find.byKey(const ValueKey('profile-edit-bio')),
      ).controller!.text,
      'Old bio',
    );
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-bio')), 'Retry after read',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pumpAndSettle();
    expect(transport.updates, 2);
  });

  testWidgets('photo editor does not discard unsaved name or biography',
      (tester) async {
    final transport = _FakeProfile();
    final avatar = _FakeAvatar();
    await tester.pumpWidget(_app(transport, avatar: avatar));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('profile-change-photo')), findsOneWidget);
    expect(find.text('Add photo'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Amina Bello',
    );
    expect(
      tester.widget<TextButton>(
        find.byKey(const ValueKey('profile-change-photo')),
      ).onPressed,
      isNotNull,
    );
    // Tapping a photo chooser with text edits is denied before file access.
    await tester.tap(find.byKey(const ValueKey('profile-change-photo')));
    await tester.pump();
    expect(find.textContaining('Save your other profile changes'), findsOneWidget);
    expect(avatar.uploads, 0);
    expect(transport.savedName, 'Amina');
  });

  testWidgets('late account A profile read cannot overwrite account B', (tester) async {
    final transport = _PendingLoads();
    await tester.pumpWidget(_app(transport));
    await tester.pump();
    expect(transport.calls, 1);

    final session = ProviderScope.containerOf(
      tester.element(find.byType(EditProfileScreen)),
    ).read(sessionProvider.notifier) as _Session;
    session.become(const SessionSignedIn(_otherUser, _otherTokens));
    await tester.pump();
    expect(transport.calls, 2);

    transport.second.complete(transport._profile(name: 'Bello', handle: 'bello'));
    await tester.pumpAndSettle();
    expect(find.text('@bello'), findsOneWidget);

    transport.first.complete(transport._profile(name: 'Amina', handle: 'amina'));
    await tester.pumpAndSettle();
    expect(find.text('@bello'), findsOneWidget);
    expect(find.text('@amina'), findsNothing);
  });

  testWidgets('late old-account save never replaces the new account editor', (tester) async {
    final transport = _PendingSave();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Amina Old Save',
    );
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-edit-save')));
    await tester.tap(find.byKey(const ValueKey('profile-edit-save')));
    await tester.pump();
    expect(transport.updates, 1);

    final session = ProviderScope.containerOf(
      tester.element(find.byType(EditProfileScreen)),
    ).read(sessionProvider.notifier) as _Session;
    transport.savedName = 'Bello';
    transport.savedHandle = 'bello';
    session.become(const SessionSignedIn(_otherUser, _otherTokens));
    await tester.pumpAndSettle();
    expect(find.text('@bello'), findsOneWidget);

    transport.completion.complete(
      transport._profile(name: 'Amina Old Save', handle: 'amina'),
    );
    await tester.pumpAndSettle();
    expect(find.text('@bello'), findsOneWidget);
    expect(
      tester.widget<TextFormField>(
        find.byKey(const ValueKey('profile-edit-name')),
      ).controller!.text,
      'Bello',
    );
    expect(find.text('Profile saved.'), findsNothing);
  });

  testWidgets('logout erases profile draft and ignores prior authenticated read', (tester) async {
    final transport = _PendingLoads();
    await tester.pumpWidget(_app(transport));
    await tester.pump();

    final session = ProviderScope.containerOf(
      tester.element(find.byType(EditProfileScreen)),
    ).read(sessionProvider.notifier) as _Session;
    session.become(const SessionSignedOut());
    await tester.pump();
    expect(find.text('Sign in to edit your profile.'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);

    transport.first.complete(transport._profile(name: 'Amina', handle: 'amina'));
    await tester.pumpAndSettle();
    expect(find.text('@amina'), findsNothing);
    expect(find.byKey(const ValueKey('profile-edit-save')), findsNothing);
    expect(find.text('Sign in to edit your profile.'), findsOneWidget);
  });

  testWidgets('token refresh for same signed-in user preserves unsaved edits', (tester) async {
    final transport = _FakeProfile();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('profile-edit-name')), 'Unsaved draft',
    );
    final session = ProviderScope.containerOf(
      tester.element(find.byType(EditProfileScreen)),
    ).read(sessionProvider.notifier) as _Session;
    session.become(SessionSignedIn(_user, const AuthTokens(
      accessToken: 'rotated',
      refreshToken: 'rotated-refresh',
      accessExpiresIn: 900,
      user: _user,
    )));
    await tester.pump();
    expect(
      tester.widget<TextFormField>(
        find.byKey(const ValueKey('profile-edit-name')),
      ).controller!.text,
      'Unsaved draft',
    );
    expect(transport.updates, 0);
  });

}
