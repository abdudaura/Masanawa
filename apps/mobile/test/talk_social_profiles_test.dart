import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/profile/person_profile_screen.dart';
import 'package:masanawa/src/screens/profile/persona_profile_screen.dart';
import 'package:masanawa/src/social/talk_social_profiles.dart';
import 'package:masanawa/src/state/talk_social_profile_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _Profiles implements TalkSocialProfileTransport {
  bool following = false;

  static const talk = TalkDiscoveryItem(
    id: 'talk-1',
    title: 'Can small businesses compete globally?',
    hostName: 'Amina',
    isLive: false,
    listenerCount: 900,
  );

  @override
  Future<HumanProfile?> loadHuman(String handle) async => HumanProfile(
        handle: handle,
        displayName: 'Amina Yusuf',
        bio: 'Technology, startups and useful conversations.',
        followerCount: following ? 1201 : 1200,
        followingCount: 80,
        isFollowing: following,
        twinPublicId: 'amina-twin',
        twinDisplayName: 'Amina Twin',
        talks: const [talk],
      );

  @override
  Future<HumanProfile> setFollowing({
    required String handle,
    required bool following,
  }) async {
    this.following = following;
    return (await loadHuman(handle))!;
  }

  @override
  Future<PersonaProfile?> loadPersona(String publicId) async {
    if (publicId == 'economist') {
      return const PersonaProfile(
        publicId: 'economist',
        displayName: 'Economist',
        kind: PersonaProfileKind.expert,
        seatFeeLabel: '₦300',
        isAvailable: true,
        role: 'Economics',
        bio: 'A Masanawa specialist for economic discussions.',
        topics: ['Economics', 'Business'],
        appearances: [talk],
        isVerified: true,
      );
    }
    return const PersonaProfile(
      publicId: 'amina-twin',
      displayName: 'Amina Twin',
      kind: PersonaProfileKind.twin,
      seatFeeLabel: '₦450',
      isAvailable: true,
      role: 'Technology',
      ownerHandle: 'amina',
      ownerDisplayName: 'Amina Yusuf',
      topics: ['Technology', 'Startups'],
    );
  }
}

Widget _app({
  required TalkSocialProfileTransport transport,
  required Widget home,
}) =>
    ProviderScope(
      overrides: [
        talkSocialProfileTransportProvider.overrideWithValue(transport),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: home,
      ),
    );

void main() {
  testWidgets('human profile follows and keeps Talks vertical', (tester) async {
    final transport = _Profiles();
    String? openedTalk;
    String? openedTwin;

    await tester.pumpWidget(
      _app(
        transport: transport,
        home: PersonProfileScreen(
          handle: 'amina',
          onOpenTalk: (id) => openedTalk = id,
          onOpenTwin: (id) => openedTwin = id,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Amina Yusuf'), findsOneWidget);
    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('Can small businesses compete globally?'), findsOneWidget);
    expect(find.byType(GridView), findsNothing);

    await tester.tap(find.byKey(const ValueKey('person-profile-follow')));
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsOneWidget);

    await tester.tap(find.text('Amina Twin'));
    expect(openedTwin, 'amina-twin');

    await tester.tap(find.text('Can small businesses compete globally?'));
    expect(openedTalk, 'talk-1');
  });

  testWidgets('Expert profile is clearly Masanawa verified', (tester) async {
    final transport = _Profiles();
    await tester.pumpWidget(
      _app(
        transport: transport,
        home: const PersonaProfileScreen(publicId: 'economist'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Economist'), findsWidgets);
    expect(find.textContaining('Masanawa Expert'), findsOneWidget);
    expect(find.text('₦300'), findsOneWidget);
    expect(find.text('Economics'), findsWidgets);
  });

  testWidgets('Twin profile shows owner and Seat fee', (tester) async {
    final transport = _Profiles();
    String? owner;

    await tester.pumpWidget(
      _app(
        transport: transport,
        home: PersonaProfileScreen(
          publicId: 'amina-twin',
          onOpenOwner: (handle) => owner = handle,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('User Twin'), findsOneWidget);
    expect(find.text('₦450'), findsOneWidget);
    expect(find.text('Owned by Amina Yusuf'), findsOneWidget);

    await tester.tap(find.text('Owned by Amina Yusuf'));
    expect(owner, 'amina');
  });
}
