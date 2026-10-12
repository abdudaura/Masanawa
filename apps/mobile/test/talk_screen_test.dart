import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/library/talk_library.dart';
import 'package:masanawa/src/social/talk_social_profiles.dart';
import 'package:masanawa/src/screens/talks/talk_screen.dart';
import 'package:masanawa/src/state/talk_ai_seat_state.dart';
import 'package:masanawa/src/state/talk_direct_twin_state.dart';
import 'package:masanawa/src/state/talk_gift_state.dart';
import 'package:masanawa/src/state/talk_library_state.dart';
import 'package:masanawa/src/state/talk_host_controls_state.dart';
import 'package:masanawa/src/state/talk_live_state.dart';
import 'package:masanawa/src/state/talk_participation_state.dart';
import 'package:masanawa/src/state/talk_poll_state.dart';
import 'package:masanawa/src/state/talk_question_state.dart';
import 'package:masanawa/src/state/talk_replay_playback_state.dart';
import 'package:masanawa/src/state/talk_safety_state.dart';
import 'package:masanawa/src/state/talk_social_profile_state.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';
import 'package:masanawa/src/talks/talk_direct_twin.dart';
import 'package:masanawa/src/talks/talk_gift.dart';
import 'package:masanawa/src/talks/talk_host_controls.dart';
import 'package:masanawa/src/talks/talk_live.dart';
import 'package:masanawa/src/talks/talk_live_audio_session.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/talks/talk_participation.dart';
import 'package:masanawa/src/talks/talk_polls.dart';
import 'package:masanawa/src/talks/talk_questions.dart';
import 'package:masanawa/src/talks/talk_replay_playback.dart';
import 'package:masanawa/src/talks/talk_safety.dart';
import 'package:masanawa/src/talks/talk_share.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _SocialProfiles implements TalkSocialProfileTransport {
  bool following = false;
  bool speakerFollowing = false;

  HumanProfile _profile({
    required String handle,
    required String displayName,
    required bool isFollowing,
  }) => HumanProfile(
    handle: handle,
    displayName: displayName,
    followerCount: isFollowing ? 11 : 10,
    followingCount: 2,
    isFollowing: isFollowing,
  );

  HumanProfile _hostProfile() => _profile(
    handle: 'abdullahi',
    displayName: 'Abdullahi',
    isFollowing: following,
  );

  HumanProfile _speakerProfile() => _profile(
    handle: 'musa',
    displayName: 'Musa',
    isFollowing: speakerFollowing,
  );

  @override
  Future<HumanProfile?> loadHuman(String handle) async =>
      handle == 'musa' ? _speakerProfile() : _hostProfile();

  @override
  Future<HumanProfile?> loadHumanByUserId(String userId) async =>
      switch (userId) {
        'host' => _hostProfile(),
        'user-speaker' => _speakerProfile(),
        _ => null,
      };

  @override
  Future<HumanProfile> setFollowing({
    required String handle,
    required bool following,
  }) async {
    this.following = following;
    return _hostProfile();
  }

  @override
  Future<HumanProfile> setFollowingUserId({
    required String userId,
    required bool following,
  }) async {
    if (userId == 'host') {
      this.following = following;
      return _hostProfile();
    }
    if (userId == 'user-speaker') {
      speakerFollowing = following;
      return _speakerProfile();
    }
    throw StateError('Unknown human participant');
  }

  @override
  Future<PersonaProfile?> loadPersona(String publicId) async => null;
}

class _SafetyTransport implements TalkSafetyTransport {
  TalkSafetyPreference preference = const TalkSafetyPreference(
    blocked: false,
    muted: false,
  );
  final List<({String talkId, bool isReplay, TalkSafetyReportReason reason})>
  reports = [];
  final List<
    ({
      TalkSafetyTargetKind targetKind,
      String targetId,
      TalkSafetyReportReason reason,
    })
  >
  targetReports = [];
  final List<({String userId, bool blocked, bool muted})> preferences = [];

  @override
  Future<TalkSafetyPreference> loadUserPreference(String userId) async =>
      preference;

  @override
  Future<TalkSafetyPreference> setUserPreference({
    required String userId,
    required bool blocked,
    required bool muted,
  }) async {
    preference = TalkSafetyPreference(blocked: blocked, muted: muted);
    preferences.add((userId: userId, blocked: blocked, muted: muted));
    return preference;
  }

  @override
  Future<void> reportTalk({
    required String talkId,
    required bool isReplay,
    required TalkSafetyReportReason reason,
    String? detail,
  }) async {
    reports.add((talkId: talkId, isReplay: isReplay, reason: reason));
  }

  @override
  Future<void> reportTarget({
    required TalkSafetyTargetKind targetKind,
    required String targetId,
    required TalkSafetyReportReason reason,
    String? detail,
  }) async {
    targetReports.add((
      targetKind: targetKind,
      targetId: targetId,
      reason: reason,
    ));
  }
}

class _ShareService implements TalkShareService {
  final List<TalkSharePayload> payloads = [];

  @override
  Future<void> share(TalkSharePayload payload) async {
    payloads.add(payload);
  }
}

class _DirectTwinTransport implements DirectTwinTransport {
  _DirectTwinTransport({this.seats = const []});

  final List<DirectTwinSeat> seats;
  int revision = 0;
  String? instruction;
  final List<String> updates = [];

  @override
  Future<List<DirectTwinSeat>> mine(String talkId) async => seats;

  @override
  Future<DirectTwinInstruction> load({
    required String talkId,
    required String seatId,
  }) async =>
      DirectTwinInstruction(revision: revision, instruction: instruction);

  @override
  Future<DirectTwinInstruction> set({
    required String talkId,
    required String seatId,
    required int revision,
    required String instruction,
  }) async {
    expect(revision, this.revision);
    updates.add(instruction);
    this.instruction = instruction;
    this.revision += 1;
    return DirectTwinInstruction(
      revision: this.revision,
      instruction: instruction,
    );
  }

  @override
  Future<DirectTwinInstruction> clear({
    required String talkId,
    required String seatId,
    required int revision,
  }) async {
    expect(revision, this.revision);
    instruction = null;
    this.revision += 1;
    return DirectTwinInstruction(revision: this.revision, instruction: null);
  }
}

class _GiftTransport implements TalkGiftTransport {
  _GiftTransport({this.fail = false, this.catalogFailure = false});

  final bool fail;
  final bool catalogFailure;
  final List<({String talkId, int amountCredits})> calls = [];

  @override
  Future<TalkGiftCatalog> loadCatalog({required String talkId}) async {
    if (catalogFailure) throw StateError('unavailable');
    return TalkGiftCatalog(
      talkId: talkId,
      items: const [
        TalkGiftCatalogItem(
          id: 'applause', name: 'Applause', visual: 'applause',
          amountCredits: 50, available: true,
        ),
        TalkGiftCatalogItem(
          id: 'heart', name: 'Heart', visual: 'heart',
          amountCredits: 100, available: true,
        ),
      ],
    );
  }

  @override
  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  }) async {
    calls.add((talkId: talkId, amountCredits: amountCredits));
    if (fail) throw Exception('DioException private transport detail');
    return TalkGiftReceipt(
      giftId: 'gift-1',
      talkId: talkId,
      recipientUserId: 'host-user',
      recipientName: 'Abdullahi',
      amountCredits: amountCredits,
      catalogItemId: catalogItemId,
      completedAt: DateTime(2026, 10, 7, 10),
    );
  }
}

class _LibraryTransport implements TalkLibraryTransport {
  bool saved = false;

  @override
  Future<MyTalksView> loadMyTalks() async => const MyTalksView();

  @override
  Future<List<TalkDiscoveryItem>> loadSavedTalks() async => const [];

  @override
  Future<TalkSavedState> loadSavedState(String talkId) async =>
      TalkSavedState(talkId: talkId, saved: saved);

  @override
  Future<TalkSavedState> setSaved({
    required String talkId,
    required bool saved,
  }) async {
    this.saved = saved;
    return TalkSavedState(talkId: talkId, saved: saved);
  }
}

class _SeatTransport implements TalkAiSeatTransport {
  const _SeatTransport();

  @override
  Future<List<TalkAiSeatCandidate>> loadCandidates({
    required String talkId,
  }) async => const [
    TalkAiSeatCandidate(
      personaId: 'expert-1',
      displayName: 'Education Expert',
      kind: TalkAiPersonaKind.expert,
      seatFeeLabel: '₦300',
      subtitle: 'Learning · Schools',
    ),
  ];

  @override
  Future<TalkAiSeatQuote> createQuote({
    required String talkId,
    required String personaId,
    required TalkAiSeatMode mode,
  }) async => TalkAiSeatQuote(
    quoteId: 'quote-1',
    personaId: personaId,
    displayName: 'Education Expert',
    kind: TalkAiPersonaKind.expert,
    mode: mode,
    totalLabel: '₦300',
    expiresAt: DateTime(2030, 1, 1, 12, 30),
    requiresHostApproval: mode == TalkAiSeatMode.sponsor,
  );

  @override
  Future<TalkAiSeatRequest> confirmQuote({
    required String talkId,
    required String quoteId,
  }) async => const TalkAiSeatRequest(
    requestId: 'request-1',
    status: TalkAiSeatRequestStatus.pendingHost,
    message: 'Waiting for the Host.',
  );
}

class _FakeLiveAudioController implements TalkLiveAudioController {
  _FakeLiveAudioController({
    required this.role,
    this.initialStatus = TalkLiveAudioStatus.listening,
  });

  @override
  final TalkLiveRole role;
  final TalkLiveAudioStatus initialStatus;
  final _states = StreamController<TalkLiveAudioStatus>.broadcast(sync: true);
  TalkLiveAudioStatus _status = TalkLiveAudioStatus.idle;
  bool _muted = false;
  int starts = 0;
  int closes = 0;

  @override
  TalkLiveAudioStatus get status => _status;

  @override
  bool get muted => _muted;

  @override
  String? get errorMessage => null;

  @override
  Stream<TalkLiveAudioStatus> get states => _states.stream;

  @override
  Future<void> start() async {
    starts += 1;
    _status = initialStatus;
    _states.add(_status);
  }

  @override
  Future<void> setMuted(bool muted) async {
    _muted = muted;
    _status = TalkLiveAudioStatus.publishing;
    _states.add(_status);
  }

  @override
  Future<void> close() async {
    closes += 1;
    _status = TalkLiveAudioStatus.ended;
    await _states.close();
  }
}

class _FakeReplayPlaybackController implements TalkReplayPlaybackController {
  final _snapshots = StreamController<TalkReplayPlaybackSnapshot>.broadcast(
    sync: true,
  );
  TalkReplayPlaybackSnapshot _snapshot = const TalkReplayPlaybackSnapshot(
    duration: Duration(minutes: 2),
  );
  int toggles = 0;
  int retries = 0;
  int closes = 0;

  @override
  TalkReplayPlaybackSnapshot get snapshot => _snapshot;

  @override
  Stream<TalkReplayPlaybackSnapshot> get snapshots => _snapshots.stream;

  @override
  Future<void> toggle() async {
    toggles += 1;
    _snapshot = _snapshot.copyWith(
      status: _snapshot.status == TalkReplayPlaybackStatus.playing
          ? TalkReplayPlaybackStatus.paused
          : TalkReplayPlaybackStatus.playing,
    );
    _snapshots.add(_snapshot);
  }

  @override
  Future<void> retry() async {
    retries += 1;
    _snapshot = _snapshot.copyWith(
      status: TalkReplayPlaybackStatus.playing,
      clearError: true,
    );
    _snapshots.add(_snapshot);
  }

  @override
  Future<void> seekTo(double fraction) async {
    _snapshot = _snapshot.copyWith(
      position: Duration(
        milliseconds: (_snapshot.duration.inMilliseconds * fraction).round(),
      ),
    );
    _snapshots.add(_snapshot);
  }

  @override
  Future<void> close() async {
    closes += 1;
    await _snapshots.close();
  }
}

class _ReplayTalkTransport implements TalkTransport {
  static const talk = TalkDiscoveryItem(
    id: 'replay-1',
    title: 'A finished Talk worth hearing again',
    hostName: 'Amina',
    isLive: false,
    listenerCount: 920,
    durationSeconds: 120,
    participants: [
      TalkParticipantPreview(
        id: 'host',
        name: 'Amina',
        kind: TalkParticipantKind.human,
        isHost: true,
      ),
    ],
  );

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async => const [
    talk,
  ];

  @override
  Future<TalkDetail> loadTalk(String talkId) async =>
      const TalkDetail(talk: talk);

  @override
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  }) async => talk;

  @override
  Future<TalkDiscoveryItem> updateTalk({
    required String talkId,
    String? title,
    String? topic,
    String? summary,
  }) async => talk;

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) async => TalkComment(
    id: 'comment-replay',
    authorName: 'You',
    body: body,
    createdAt: DateTime(2026, 10, 7, 10),
  );
}

class _HostControlsTransport implements TalkHostControlsTransport {
  int accepted = 0;
  final List<({String talkId, String handle})> invitations = [];
  int muted = 0;
  int removed = 0;
  int ended = 0;

  @override
  Future<void> inviteHuman({
    required String talkId,
    required String handle,
  }) async {
    invitations.add((talkId: talkId, handle: handle));
  }

  @override
  Future<TalkHostControlsView> load(String talkId) async =>
      const TalkHostControlsView(
        requests: [
          TalkHostRequest(
            requestId: 'request-1',
            kind: TalkHostRequestKind.humanSpeaker,
            displayName: 'Amina',
            detail: 'Wants to join the discussion',
          ),
        ],
        participants: [
          TalkHostParticipant(
            participantId: 'host',
            displayName: 'Abdullahi',
            kind: TalkParticipantKind.human,
            isHost: true,
            isMuted: false,
          ),
          TalkHostParticipant(
            participantId: 'speaker',
            displayName: 'Musa',
            kind: TalkParticipantKind.human,
            isHost: false,
            isMuted: false,
            userId: 'user-speaker',
            profileHandle: 'musa',
          ),
          TalkHostParticipant(
            participantId: 'expert',
            displayName: 'Economist',
            kind: TalkParticipantKind.expert,
            isHost: false,
            isMuted: false,
            personaId: 'expert-economist',
          ),
        ],
      );

  @override
  Future<TalkHostControlsView> actOnRequest({
    required String talkId,
    required String requestId,
    required TalkHostRequestAction action,
  }) async {
    if (action == TalkHostRequestAction.accept) accepted += 1;
    return const TalkHostControlsView();
  }

  @override
  Future<TalkHostControlsView> actOnParticipant({
    required String talkId,
    required String participantId,
    required TalkHostParticipantAction action,
  }) async {
    if (participantId == 'speaker' &&
        action == TalkHostParticipantAction.mute) {
      muted += 1;
    }
    if (action == TalkHostParticipantAction.remove) {
      removed += 1;
    }
    return await load(talkId);
  }

  @override
  Future<void> endTalk(String talkId) async {
    ended += 1;
  }
}

class _ParticipationTransport implements TalkParticipationTransport {
  TalkParticipationState state = const TalkParticipationState();
  String? reactedWith;
  bool? raised;
  int leftSeat = 0;

  @override
  Future<TalkParticipationState> leaveSeat(String talkId) async {
    leftSeat += 1;
    state = TalkParticipationState(
      handStatus: TalkHandStatus.idle,
      reaction: state.reaction,
    );
    return state;
  }

  @override
  Future<TalkParticipationState> load(String talkId) async => state;

  @override
  Future<TalkParticipationState> react({
    required String talkId,
    required String reaction,
  }) async {
    reactedWith = reaction;
    state = TalkParticipationState(
      handStatus: state.handStatus,
      reaction: reaction,
    );
    return state;
  }

  @override
  Future<TalkParticipationState> setHandRaised({
    required String talkId,
    required bool raised,
  }) async {
    this.raised = raised;
    state = TalkParticipationState(
      handStatus: raised ? TalkHandStatus.raised : TalkHandStatus.idle,
      reaction: state.reaction,
    );
    return state;
  }
}

class _PollTransport implements TalkPollTransport {
  _PollTransport({this.current});

  TalkPoll? current;
  final List<({String question, List<String> options})> created = [];
  final List<String> voted = [];
  int closed = 0;

  static TalkPoll active() => TalkPoll(
    pollId: 'poll-1',
    question: 'Which topic next?',
    isOpen: true,
    options: const [
      TalkPollOption(optionId: 'jobs', label: 'Jobs', voteCount: 2),
      TalkPollOption(optionId: 'education', label: 'Education', voteCount: 1),
    ],
    totalVotes: 3,
    createdAt: DateTime(2026, 10, 7, 11, 30),
  );

  @override
  Future<TalkPoll?> load(String talkId) async => current;

  @override
  Future<TalkPoll> create({
    required String talkId,
    required String question,
    required List<String> options,
  }) async {
    created.add((question: question, options: List.of(options)));
    current = TalkPoll(
      pollId: 'poll-created',
      question: question,
      isOpen: true,
      options: [
        for (var i = 0; i < options.length; i++)
          TalkPollOption(
            optionId: 'created-$i',
            label: options[i],
            voteCount: 0,
          ),
      ],
      totalVotes: 0,
      createdAt: DateTime(2026, 10, 7, 11, 31),
    );
    return current!;
  }

  @override
  Future<TalkPoll> vote({
    required String talkId,
    required String pollId,
    required String optionId,
  }) async {
    voted.add(optionId);
    final source = current!;
    current = TalkPoll(
      pollId: source.pollId,
      question: source.question,
      isOpen: source.isOpen,
      options: [
        for (final option in source.options)
          TalkPollOption(
            optionId: option.optionId,
            label: option.label,
            voteCount: option.optionId == optionId
                ? option.voteCount + 1
                : option.voteCount,
          ),
      ],
      totalVotes: source.totalVotes + 1,
      myOptionId: optionId,
      createdAt: source.createdAt,
    );
    return current!;
  }

  @override
  Future<TalkPoll> close({
    required String talkId,
    required String pollId,
  }) async {
    closed += 1;
    final source = current!;
    final result = TalkPoll(
      pollId: source.pollId,
      question: source.question,
      isOpen: false,
      options: source.options,
      totalVotes: source.totalVotes,
      myOptionId: source.myOptionId,
      createdAt: source.createdAt,
      closedAt: DateTime(2026, 10, 7, 11, 32),
    );
    current = null;
    return result;
  }
}

class _QuestionTransport implements TalkQuestionTransport {
  final List<String> submitted = [];
  List<TalkQuestion> queue = [
    TalkQuestion(
      questionId: 'question-1',
      authorName: 'Zainab',
      body: 'Can you explain the evidence?',
      status: TalkQuestionStatus.pending,
      createdAt: DateTime(2026, 10, 7, 10),
    ),
  ];
  int resolved = 0;

  @override
  Future<TalkQuestion> submit({
    required String talkId,
    required String body,
  }) async {
    submitted.add(body);
    return TalkQuestion(
      questionId: 'question-new',
      authorName: 'You',
      body: body,
      status: TalkQuestionStatus.pending,
      createdAt: DateTime(2026, 10, 7, 10, 1),
    );
  }

  @override
  Future<List<TalkQuestion>> loadHostQueue(String talkId) async =>
      List.unmodifiable(queue);

  @override
  Future<List<TalkQuestion>> resolve({
    required String talkId,
    required String questionId,
    required TalkQuestionStatus status,
  }) async {
    resolved += 1;
    queue = queue.where((item) => item.questionId != questionId).toList();
    return List.unmodifiable(queue);
  }
}

class _TalkTransport implements TalkTransport {
  final List<TalkComment> comments = [
    TalkComment(
      id: 'c1',
      authorName: 'Fatima',
      body: 'This is the kind of conversation I came here for.',
      createdAt: DateTime(2026, 10, 7, 8),
      likeCount: 12,
    ),
  ];

  static const talk = TalkDiscoveryItem(
    id: 'talk-1',
    title: 'Will AI make education more equal?',
    hostName: 'Abdullahi',
    isLive: true,
    listenerCount: 1800,
    commentCount: 1,
    participants: [
      TalkParticipantPreview(
        id: 'host',
        name: 'Abdullahi',
        kind: TalkParticipantKind.human,
        isHost: true,
      ),
      TalkParticipantPreview(
        id: 'user-speaker',
        name: 'Musa',
        kind: TalkParticipantKind.human,
      ),
      TalkParticipantPreview(
        id: 'expert',
        name: 'Education Expert',
        kind: TalkParticipantKind.expert,
      ),
    ],
  );

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async => const [
    talk,
  ];

  @override
  Future<TalkDetail> loadTalk(String talkId) async =>
      TalkDetail(talk: talk, comments: List.unmodifiable(comments));

  @override
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  }) async => talk;

  final List<({String talkId, String? title, String? topic, String? summary})>
  updates = [];

  @override
  Future<TalkDiscoveryItem> updateTalk({
    required String talkId,
    String? title,
    String? topic,
    String? summary,
  }) async {
    updates.add((talkId: talkId, title: title, topic: topic, summary: summary));
    return TalkDiscoveryItem(
      id: talk.id,
      title: title ?? talk.title,
      summary: summary ?? talk.summary,
      hostName: talk.hostName,
      topic: topic ?? talk.topic,
      isLive: talk.isLive,
      listenerCount: talk.listenerCount,
      commentCount: talk.commentCount,
      participants: talk.participants,
    );
  }

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) async {
    final comment = TalkComment(
      id: 'c2',
      authorName: 'You',
      body: body,
      createdAt: DateTime(2026, 10, 7, 9),
    );
    comments.add(comment);
    return comment;
  }
}

Widget _app({
  required TalkTransport talkTransport,
  Widget? home,
  _ParticipationTransport? participation,
  _HostControlsTransport? hostControls,
  _PollTransport? polls,
  _QuestionTransport? questions,
  _FakeLiveAudioController? liveAudio,
  _FakeReplayPlaybackController? replayPlayback,
  _LibraryTransport? library,
  _GiftTransport? gift,
  _ShareService? share,
  _SafetyTransport? safety,
  _SocialProfiles? social,
  _DirectTwinTransport? directTwin,
}) {
  return ProviderScope(
    overrides: [
      talkTransportProvider.overrideWithValue(talkTransport),
      talkAiSeatTransportProvider.overrideWithValue(const _SeatTransport()),
      talkParticipationTransportProvider.overrideWithValue(
        participation ?? _ParticipationTransport(),
      ),
      talkHostControlsTransportProvider.overrideWithValue(
        hostControls ?? _HostControlsTransport(),
      ),
      talkPollTransportProvider.overrideWithValue(polls ?? _PollTransport()),
      talkQuestionTransportProvider.overrideWithValue(
        questions ?? _QuestionTransport(),
      ),
      talkLibraryTransportProvider.overrideWithValue(
        library ?? _LibraryTransport(),
      ),
      talkGiftTransportProvider.overrideWithValue(gift ?? _GiftTransport()),
      talkShareServiceProvider.overrideWithValue(share ?? _ShareService()),
      talkSafetyTransportProvider.overrideWithValue(
        safety ?? _SafetyTransport(),
      ),
      talkSocialProfileTransportProvider.overrideWithValue(
        social ?? _SocialProfiles(),
      ),
      directTwinTransportProvider.overrideWithValue(
        directTwin ?? _DirectTwinTransport(),
      ),
      talkLiveAudioFactoryProvider.overrideWithValue(
        (_) =>
            liveAudio ?? _FakeLiveAudioController(role: TalkLiveRole.listener),
      ),
      talkReplayPlaybackFactoryProvider.overrideWithValue(
        (_) => replayPlayback ?? _FakeReplayPlaybackController(),
      ),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home:
          home ??
          const TalkScreen(talkId: 'talk-1', initialTalk: _TalkTransport.talk),
    ),
  );
}

void main() {
  testWidgets('replay Talk shows native playback without LiveKit autoplay', (
    tester,
  ) async {
    final transport = _ReplayTalkTransport();
    final liveAudio = _FakeLiveAudioController(role: TalkLiveRole.listener);
    final replay = _FakeReplayPlaybackController();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        liveAudio: liveAudio,
        replayPlayback: replay,
        home: const TalkScreen(
          talkId: 'replay-1',
          initialTalk: _ReplayTalkTransport.talk,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Talk Replay'), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-replay-player')), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-replay-toggle')), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-live-mic-toggle')), findsNothing);
    expect(liveAudio.starts, 0);
    expect(replay.toggles, 0);

    await tester.tap(find.byKey(const ValueKey('talk-replay-toggle')));
    await tester.pumpAndSettle();

    expect(replay.toggles, 1);
    expect(find.byTooltip('Pause replay'), findsOneWidget);
    expect(liveAudio.starts, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Talk keeps live controls and comments on one screen', (
    tester,
  ) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(_app(talkTransport: transport));
    await tester.pumpAndSettle();

    expect(find.text('Will AI make education more equal?'), findsOneWidget);
    expect(find.text('Raise hand'), findsOneWidget);
    expect(find.text('Add AI'), findsOneWidget);
    expect(find.text('Comments'), findsOneWidget);
    expect(
      find.text('This is the kind of conversation I came here for.'),
      findsOneWidget,
    );
    expect(find.text('Share your thoughts…'), findsOneWidget);
  });

  testWidgets('owned active Twin Seat exposes private Direct Twin control', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final directTwin = _DirectTwinTransport(
      seats: const [DirectTwinSeat(seatId: 'seat-twin-1', personaId: 'twin-1')],
    );

    await tester.pumpWidget(
      _app(talkTransport: transport, directTwin: directTwin),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-direct-twin')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-direct-twin')));
    await tester.pumpAndSettle();

    expect(find.text('Direct Twin'), findsOneWidget);
    await tester.tap(find.widgetWithText(ActionChip, 'Challenge that'));
    await tester.pumpAndSettle();

    expect(directTwin.updates, ['Challenge that']);
    expect(find.text('Twin direction updated.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('live Talk shares canonical public URL with title and Host', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final share = _ShareService();

    await tester.pumpWidget(_app(talkTransport: transport, share: share));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-share')));
    await tester.pumpAndSettle();

    expect(share.payloads, hasLength(1));
    expect(share.payloads.single.talkId, 'talk-1');
    expect(
      share.payloads.single.text,
      'Will AI make education more equal?\n'
      'Hosted by Abdullahi\n'
      'https://masanawa.com/talk/talk-1',
    );
    expect(
      share.payloads.single.url.toString(),
      'https://masanawa.com/talk/talk-1',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('replay shares the same stable Talk deep-link shape', (
    tester,
  ) async {
    final transport = _ReplayTalkTransport();
    final share = _ShareService();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        share: share,
        home: const TalkScreen(
          talkId: 'replay-1',
          initialTalk: _ReplayTalkTransport.talk,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-share')));
    await tester.pumpAndSettle();

    expect(share.payloads, hasLength(1));
    expect(share.payloads.single.talkId, 'replay-1');
    expect(
      share.payloads.single.text,
      'A finished Talk worth hearing again\n'
      'Hosted by Amina\n'
      'https://masanawa.com/talk/replay-1',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Talk More shows labeled participants and reports privately', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final safety = _SafetyTransport();

    await tester.pumpWidget(_app(talkTransport: transport, safety: safety));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();

    expect(find.text('Talk options'), findsOneWidget);
    expect(find.text('View participants'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-more-participants')));
    await tester.pumpAndSettle();

    expect(find.text('Participants'), findsOneWidget);
    expect(find.text('Human · Host'), findsOneWidget);
    expect(find.text('Masanawa Expert · AI'), findsOneWidget);

    Navigator.of(tester.element(find.text('Participants'))).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-more-report')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-report-harassment')));
    await tester.pumpAndSettle();

    expect(safety.reports, hasLength(1));
    expect(safety.reports.single.talkId, 'talk-1');
    expect(safety.reports.single.isReplay, isFalse);
    expect(safety.reports.single.reason, TalkSafetyReportReason.harassment);
    expect(find.text('Report received. Thank you.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener follows a human Speaker from Participants but not AI', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final social = _SocialProfiles();

    await tester.pumpWidget(_app(talkTransport: transport, social: social));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-more-participants')));
    await tester.pumpAndSettle();

    expect(find.text('Human · Speaker'), findsOneWidget);
    expect(find.text('Masanawa Expert · AI'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('talk-participant-follow-user-speaker')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('talk-participant-follow-expert')),
      findsNothing,
    );

    await tester.tap(
      find.byKey(const ValueKey('talk-participant-follow-user-speaker')),
    );
    await tester.pumpAndSettle();

    expect(social.speakerFollowing, isTrue);
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('talk-participant-follow-user-speaker')),
        matching: find.text('Following'),
      ),
      findsOneWidget,
    );

    await tester.tap(
      find.byKey(const ValueKey('talk-participant-follow-user-speaker')),
    );
    await tester.pumpAndSettle();

    expect(social.speakerFollowing, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host participant sheet stays read-only', (tester) async {
    final transport = _TalkTransport();
    final social = _SocialProfiles();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        social: social,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-more-participants')));
    await tester.pumpAndSettle();

    expect(find.text('Human · Speaker'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('talk-participant-follow-user-speaker')),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Talk More updates Host mute and block preferences', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final safety = _SafetyTransport();

    await tester.pumpWidget(_app(talkTransport: transport, safety: safety));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();

    expect(find.text('Mute Host'), findsOneWidget);
    expect(find.text('Block Host'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-more-mute-host')));
    await tester.pumpAndSettle();

    expect(safety.preferences.last, (
      userId: 'host',
      blocked: false,
      muted: true,
    ));

    await tester.tap(find.byKey(const ValueKey('talk-more-block-host')));
    await tester.pumpAndSettle();

    expect(safety.preferences.last, (
      userId: 'host',
      blocked: true,
      muted: true,
    ));
    expect(tester.takeException(), isNull);
  });

  testWidgets('replay report uses replay safety target', (tester) async {
    final transport = _ReplayTalkTransport();
    final safety = _SafetyTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        safety: safety,
        home: const TalkScreen(
          talkId: 'replay-1',
          initialTalk: _ReplayTalkTransport.talk,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();
    expect(find.text('Report replay'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-more-report')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-report-spam')));
    await tester.pumpAndSettle();

    expect(safety.reports.single.talkId, 'replay-1');
    expect(safety.reports.single.isReplay, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host edits Talk title topic and summary from More', (
    tester,
  ) async {
    final transport = _TalkTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-more-edit')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-more-edit')));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('talk-edit-title')),
      'AI and education: what changes next',
    );
    await tester.enterText(
      find.byKey(const ValueKey('talk-edit-topic')),
      'Education and AI',
    );
    await tester.enterText(
      find.byKey(const ValueKey('talk-edit-summary')),
      'A concise summary for people discovering the replay later.',
    );
    await tester.tap(find.byKey(const ValueKey('talk-edit-save')));
    await tester.pumpAndSettle();

    expect(transport.updates, hasLength(1));
    expect(transport.updates.single.talkId, 'talk-1');
    expect(
      transport.updates.single.title,
      'AI and education: what changes next',
    );
    expect(transport.updates.single.topic, 'Education and AI');
    expect(
      transport.updates.single.summary,
      'A concise summary for people discovering the replay later.',
    );
    expect(find.byKey(const ValueKey('talk-more-edit')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener does not see Host-only Talk metadata editing', (
    tester,
  ) async {
    final transport = _TalkTransport();

    await tester.pumpWidget(_app(talkTransport: transport));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-more-edit')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener follows and unfollows the Talk Host from More', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final social = _SocialProfiles();

    await tester.pumpWidget(_app(talkTransport: transport, social: social));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-more-follow-host')), findsOneWidget);
    expect(find.text('Follow Host'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-more-follow-host')));
    await tester.pumpAndSettle();

    expect(social.following, isTrue);
    expect(find.text('Following'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-more-follow-host')));
    await tester.pumpAndSettle();

    expect(social.following, isFalse);
    expect(find.text('Follow Host'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host never sees a self-follow action in Talk More', (
    tester,
  ) async {
    final transport = _TalkTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('talk-more')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-more-follow-host')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener can send a live question to the Host', (tester) async {
    final transport = _TalkTransport();
    final questions = _QuestionTransport();

    await tester.pumpWidget(
      _app(talkTransport: transport, questions: questions),
    );
    await tester.pumpAndSettle();

    expect(find.text('Ask'), findsOneWidget);
    await tester.tap(find.text('Ask'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('talk-question-input')),
      'What evidence supports that?',
    );
    await tester.tap(find.byKey(const ValueKey('talk-question-submit')));
    await tester.pumpAndSettle();

    expect(questions.submitted, ['What evidence supports that?']);
    expect(find.text('Question sent to the Host.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener can vote in the active Talk poll', (tester) async {
    final transport = _TalkTransport();
    final polls = _PollTransport(current: _PollTransport.active());

    await tester.pumpWidget(_app(talkTransport: transport, polls: polls));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-poll-card')), findsOneWidget);
    expect(find.text('Which topic next?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-poll-option-education')));
    await tester.pumpAndSettle();

    expect(polls.voted, ['education']);
    expect(find.text('4 votes'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host can start and close an inline Talk poll', (tester) async {
    final transport = _TalkTransport();
    final polls = _PollTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        polls: polls,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-poll-start')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-poll-start')));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('talk-poll-question')),
      'Which topic next?',
    );
    await tester.enterText(
      find.byKey(const ValueKey('talk-poll-option-0')),
      'Jobs',
    );
    await tester.enterText(
      find.byKey(const ValueKey('talk-poll-option-1')),
      'Education',
    );
    await tester.tap(find.byKey(const ValueKey('talk-poll-create')));
    await tester.pumpAndSettle();

    expect(polls.created.single.question, 'Which topic next?');
    expect(polls.created.single.options, ['Jobs', 'Education']);
    expect(find.byKey(const ValueKey('talk-poll-card')), findsOneWidget);

    tester.testTextInput.hide();
    await tester.pumpAndSettle();
    await Scrollable.ensureVisible(
      tester.element(find.byKey(const ValueKey('talk-poll-close'))),
      alignment: .5,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-poll-close')));
    await tester.pumpAndSettle();

    expect(polls.closed, 1);
    expect(find.byKey(const ValueKey('talk-poll-start')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Talk can be saved and unsaved from the app bar', (tester) async {
    final transport = _TalkTransport();
    final library = _LibraryTransport();

    await tester.pumpWidget(_app(talkTransport: transport, library: library));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Save Talk'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-save-toggle')));
    await tester.pumpAndSettle();

    expect(library.saved, isTrue);
    expect(find.byTooltip('Remove from Saved'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-save-toggle')));
    await tester.pumpAndSettle();

    expect(library.saved, isFalse);
    expect(find.byTooltip('Save Talk'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener can send a Credit gift to the Host', (tester) async {
    final transport = _TalkTransport();
    final gift = _GiftTransport();

    await tester.pumpWidget(_app(talkTransport: transport, gift: gift));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Gift'));
    await tester.pumpAndSettle();

    expect(find.text('Gift Abdullahi'), findsOneWidget);
    expect(find.text('Send Credits to the Host.'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-gift-heart')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('talk-gift-send')));
    await tester.pumpAndSettle();

    expect(gift.calls, [(talkId: 'talk-1', amountCredits: 100)]);
    expect(find.text('100 Cr sent to Abdullahi.'), findsOneWidget);
    expect(find.text('Gift Abdullahi'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('failed Talk gift stays in sheet with friendly error', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final gift = _GiftTransport(fail: true);

    await tester.pumpWidget(_app(talkTransport: transport, gift: gift));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Gift'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-gift-applause')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('talk-gift-send')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-gift-error')), findsOneWidget);
    expect(
      find.text('Couldn’t confirm this gift. Check Wallet history before retrying.'),
      findsOneWidget,
    );
    expect(find.textContaining('DioException'), findsNothing);
    expect(find.text('Gift Abdullahi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });


  testWidgets('verified Credit gift briefly displays a bounded local overlay',
      (tester) async {
    final gift = _GiftTransport();
    await tester.pumpWidget(_app(talkTransport: _TalkTransport(), gift: gift));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gift'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-gift-heart')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('talk-gift-send')));
    // Finish the asynchronous sheet close and entrance animation without
    // advancing the bounded feedback timer.
    await tester.pumpAndSettle();
    expect(find.text('Sent to Abdullahi'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    expect(find.text('Sent to Abdullahi'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('missing authoritative gift catalog never offers fixed client prices',
      (tester) async {
    await tester.pumpWidget(_app(
      talkTransport: _TalkTransport(),
      gift: _GiftTransport(catalogFailure: true),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gift'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-gift-applause')), findsNothing);
    expect(find.byKey(const ValueKey('talk-gift-send')), findsNothing);
    expect(find.text('Gift options are unavailable right now.'), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-gift-retry-catalog')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener can post a comment without leaving the Talk', (
    tester,
  ) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        home: const TalkScreen(talkId: 'talk-1'),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField).last,
      'I want to hear more about rural schools.',
    );
    await tester.tap(find.byTooltip('Post comment'));
    await tester.pumpAndSettle();

    expect(
      find.text('I want to hear more about rural schools.'),
      findsOneWidget,
    );
    expect(transport.comments.length, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener opens Sponsor Seat sheet from Add AI', (tester) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(_app(talkTransport: transport));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add AI'));
    await tester.pumpAndSettle();

    expect(find.text('Sponsor a Seat'), findsOneWidget);
    expect(find.text('Education Expert'), findsWidgets);
    expect(find.text('Sponsor'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener can react without leaving the Talk', (tester) async {
    final transport = _TalkTransport();
    final participation = _ParticipationTransport();

    await tester.pumpWidget(
      _app(talkTransport: transport, participation: participation),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('React'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-reaction-❤️')));
    await tester.pumpAndSettle();

    expect(participation.reactedWith, '❤️');
    expect(find.text('❤️'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'listener raises and lowers hand through Host-controlled request',
    (tester) async {
      final transport = _TalkTransport();
      final participation = _ParticipationTransport();

      await tester.pumpWidget(
        _app(talkTransport: transport, participation: participation),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Raise hand'));
      await tester.pumpAndSettle();
      expect(find.text('Ask to speak?'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('raise-hand-confirm')));
      await tester.pumpAndSettle();

      expect(participation.raised, isTrue);
      expect(find.text('Hand raised'), findsOneWidget);

      await tester.tap(find.text('Hand raised'));
      await tester.pumpAndSettle();
      expect(find.text('Your hand is raised'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('raise-hand-confirm')));
      await tester.pumpAndSettle();

      expect(participation.raised, isFalse);
      expect(find.text('Raise hand'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('live listener auto-connects to Talk audio', (tester) async {
    final transport = _TalkTransport();
    final liveAudio = _FakeLiveAudioController(
      role: TalkLiveRole.listener,
      initialStatus: TalkLiveAudioStatus.listening,
    );

    await tester.pumpWidget(
      _app(talkTransport: transport, liveAudio: liveAudio),
    );
    await tester.pumpAndSettle();

    expect(liveAudio.starts, 1);
    expect(find.text('Listening'), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-live-mic-toggle')), findsNothing);
  });

  testWidgets('Host live audio exposes microphone mute control', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final liveAudio = _FakeLiveAudioController(
      role: TalkLiveRole.host,
      initialStatus: TalkLiveAudioStatus.publishing,
    );

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        liveAudio: liveAudio,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('On mic'), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-live-mic-toggle')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-live-mic-toggle')));
    await tester.pumpAndSettle();

    expect(liveAudio.muted, isTrue);
    expect(find.text('Muted'), findsOneWidget);
  });

  testWidgets('Speaker live audio exposes microphone mute control', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final liveAudio = _FakeLiveAudioController(
      role: TalkLiveRole.speaker,
      initialStatus: TalkLiveAudioStatus.publishing,
    );
    final participation = _ParticipationTransport()
      ..state = const TalkParticipationState(
        handStatus: TalkHandStatus.accepted,
      );

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        liveAudio: liveAudio,
        participation: participation,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('On mic'), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-live-mic-toggle')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('talk-live-mic-toggle')));
    await tester.pumpAndSettle();

    expect(liveAudio.muted, isTrue);
    expect(find.text('Muted'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('accepted human Speaker can return to the Audience', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final participation = _ParticipationTransport()
      ..state = const TalkParticipationState(
        handStatus: TalkHandStatus.accepted,
        reaction: '👏',
      );

    await tester.pumpWidget(
      _app(talkTransport: transport, participation: participation),
    );
    await tester.pumpAndSettle();

    expect(find.text('Leave seat'), findsOneWidget);
    await tester.tap(find.text('Leave seat'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(participation.leftSeat, 1);
    expect(participation.state.handStatus, TalkHandStatus.idle);
    expect(find.text('You’re back in the Audience.'), findsOneWidget);
    expect(find.text('Raise hand'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host sees moderation controls instead of Raise Hand', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Requests 1'), findsOneWidget);
    expect(find.text('Manage'), findsOneWidget);
    expect(find.text('End'), findsOneWidget);
    expect(find.text('Raise hand'), findsNothing);

    await tester.tap(find.text('Requests 1'));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    expect(find.text('Wants to speak · Free'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('host-request-accept-request-1')),
    );
    await tester.pumpAndSettle();
    expect(host.accepted, 1);
  });

  testWidgets('Host invites a verified human from Manage', (tester) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Manage'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('host-invite-human')));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('host-invite-human-handle')),
      '@amina',
    );
    await tester.tap(find.byKey(const ValueKey('host-invite-human-send')));
    await tester.pumpAndSettle();

    expect(host.invitations, [(talkId: 'talk-1', handle: 'amina')]);
    expect(find.text('Invitation sent to @amina.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host can review and resolve audience questions', (tester) async {
    final transport = _TalkTransport();
    final questions = _QuestionTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        questions: questions,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Questions 1'), findsOneWidget);
    await tester.tap(find.text('Questions 1'));
    await tester.pumpAndSettle();

    expect(find.text('Zainab'), findsOneWidget);
    expect(find.text('Can you explain the evidence?'), findsOneWidget);
    await tester.tap(find.text('Answered'));
    await tester.pumpAndSettle();

    expect(questions.resolved, 1);
    expect(find.text('No questions waiting.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host can manage a Speaker but has no self-removal control', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Manage'));
    await tester.pumpAndSettle();

    expect(find.text('Abdullahi'), findsWidgets);
    expect(find.text('Musa'), findsWidgets);
    expect(find.text('You'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('host-participant-menu-speaker')),
      findsOneWidget,
    );

    await tester.tap(
      find.byKey(const ValueKey('host-participant-menu-speaker')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mute'));
    await tester.pumpAndSettle();

    expect(host.muted, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host reports a human Speaker using the public profile target', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();
    final safety = _SafetyTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        safety: safety,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Manage'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-menu-speaker')),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-report-speaker')),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-report-reason-harassment')),
    );
    await tester.pumpAndSettle();

    expect(safety.targetReports, hasLength(1));
    expect(
      safety.targetReports.single.targetKind,
      TalkSafetyTargetKind.profile,
    );
    expect(safety.targetReports.single.targetId, 'musa');
    expect(
      safety.targetReports.single.reason,
      TalkSafetyReportReason.harassment,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host can block and remove a human Speaker', (tester) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();
    final safety = _SafetyTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        safety: safety,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Manage'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-menu-speaker')),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-block-speaker')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Block Musa?'), findsOneWidget);
    await tester.tap(
      find.byKey(const ValueKey('host-participant-block-confirm')),
    );
    await tester.pumpAndSettle();

    expect(safety.preferences.last, (
      userId: 'user-speaker',
      blocked: true,
      muted: false,
    ));
    expect(host.removed, 1);
    expect(find.text('Participant blocked and removed.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host reports AI by persona identity and never gets Block', (
    tester,
  ) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();
    final safety = _SafetyTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        safety: safety,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Manage'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-menu-expert')),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('host-participant-block-expert')),
      findsNothing,
    );
    await tester.tap(
      find.byKey(const ValueKey('host-participant-report-expert')),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('host-participant-report-reason-spam')),
    );
    await tester.pumpAndSettle();

    expect(
      safety.targetReports.single.targetKind,
      TalkSafetyTargetKind.persona,
    );
    expect(safety.targetReports.single.targetId, 'expert-economist');
    expect(tester.takeException(), isNull);
  });

  testWidgets('Host End Talk requires explicit confirmation', (tester) async {
    final transport = _TalkTransport();
    final host = _HostControlsTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        hostControls: host,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('End'));
    await tester.pumpAndSettle();
    expect(find.text('End this Talk?'), findsOneWidget);
    expect(host.ended, 0);

    await tester.tap(find.byKey(const ValueKey('end-talk-confirm')));
    await tester.pumpAndSettle();
    expect(host.ended, 1);
  });

  testWidgets('host opens direct Add AI semantics', (tester) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add AI'));
    await tester.pumpAndSettle();

    expect(find.text('Add AI'), findsWidgets);
    expect(find.text('Add'), findsOneWidget);
    expect(find.text('Sponsor a Seat'), findsNothing);
  });
}
