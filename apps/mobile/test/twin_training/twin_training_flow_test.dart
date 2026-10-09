import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/clone_onboarding.dart';
import 'package:masanawa/src/agents/creator_clone.dart';
import 'package:masanawa/src/agents/twin_profile.dart';
import 'package:masanawa/src/state/clone_onboarding_controller.dart';
import 'package:masanawa/src/twin_training/twin_training_flow.dart';

const _requestId = 'request_019a1b2c-1234-7abc-8abc-0123456789ab';
const _char = 'character_019a1b2c-1234-7abc-8abc-0123456789ab';

class SavedSetup implements CloneOnboardingTransport {
  int revision = 1;
  String state = 'editing';
  String? name;
  String biography = 'A personal Masanawa clone.';
  List<String> languages = [];
  List<String> personality = ['Friendly', 'Clear'];
  List<String> expertise = ['Everyday conversation'];
  bool failNext = false;
  int confirmations = 0;
  Future<CloneOnboardingView> _read() async {
    if (failNext) {
      failNext = false;
      throw StateError('unknown network outcome');
    }
    return CloneOnboardingView(
      revision: revision, state: state,
      profile: CloneSetupProfile(
        displayName: name,
        biography: biography,
        languages: languages,
        personality: personality,
        expertise: expertise,
      ),
      confirmationRequestId: state == 'ready' || state == 'confirmed' ? _requestId : null,
      confirmationPreviewRevision: state == 'ready' || state == 'confirmed' ? revision - 1 : null,
      result: state == 'ready'
          ? const CreatorCloneResult(
              created: true, characterId: _char,
              characterVersionId: 'character-version_v',
              relationshipId: 'relationship_r', displayName: 'Owner')
          : null,
      prompt: 'Saved on Gateway',
    );
  }

  @override
  Future<CloneOnboardingView> read() => _read();

  @override
  Future<CloneOnboardingView> save({
    required int? expectedRevision,
    required Map<String, dynamic> profile,
  }) async {
    if (expectedRevision != revision || state == 'ready' || state == 'confirmed') {
      throw StateError('revision conflict');
    }
    name = profile['displayName'] as String? ?? name;
    biography = profile['biography'] as String? ?? biography;
    languages = (profile['languages'] as List?)?.cast<String>() ?? languages;
    expertise = (profile['expertise'] as List?)?.cast<String>() ?? expertise;
    personality = (profile['personality'] as List?)?.cast<String>() ?? personality;
    revision++;
    state = 'editing';
    return _read();
  }

  @override
  Future<CloneOnboardingView> preview(int expectedRevision) async {
    if (expectedRevision != revision || name == null || languages.isEmpty) {
      throw StateError('preview conflict');
    }
    revision++;
    state = 'preview';
    return _read();
  }

  @override
  Future<CloneOnboardingView> confirm({
    required int expectedPreviewRevision,
    required String requestId,
  }) async {
    confirmations++;
    if (state == 'confirmed' && requestId == _requestId &&
        expectedPreviewRevision == revision - 1) {
      revision++;
      state = 'ready';
      return _read();
    }
    if (requestId != _requestId || state != 'preview' ||
        expectedPreviewRevision != revision) throw StateError('bad confirmation');
    revision++;
    state = 'ready';
    return _read();
  }

  @override
  Future<CloneOnboardingView> cancel(int expectedRevision) async {
    state = 'cancelled';
    revision++;
    return _read();
  }
}

class SavedTwin implements TwinProfileTransport {
  bool public = false;
  bool forged = false;
  bool uncertain = false;
  int applyCalls = 0;
  int previewCalls = 0;
  TwinProfile get _profile => TwinProfile(
    hasTwin: true, characterId: forged ? 'another-owner' : _char,
    displayName: 'Owner', bio: 'Biography', publicUrl: null,
    discoverable: public, voiceEnabled: false,
    ownerAccessEnabled: false, languages: const ['Hausa'],
    summary: const TwinPerformanceSummary(
      visitors: 0, conversations: 0, earningsCredits: 0, pendingOwnerRequests: 0,
    ),
  );

  @override
  Future<TwinProfile> load() async => _profile;
  @override
  Future<TwinProfile> setDiscoverable(bool next) async {
    throw StateError('must use revision CAS review');
  }
  @override
  Future<TwinProfileCustomizationPreview> previewCustomization(
    TwinProfileCustomizationPatch patch,
  ) async {
    previewCalls++;
    return const TwinProfileCustomizationPreview(
      currentRevision: 4,
      patch: TwinProfileCustomizationPatch(discoverable: true),
      requiresConfirmation: true, standingChanges: ['publish-profile'],
    );
  }
  @override
  Future<TwinProfile> applyCustomization({
    required TwinProfileCustomizationPreview preview,
    required bool confirmed,
  }) async {
    applyCalls++;
    if (!confirmed) throw StateError('confirmation required');
    public = true;
    if (uncertain) throw StateError('unknown after commit');
    return _profile;
  }
}

TwinTrainingFlow fixture(SavedSetup setup, SavedTwin twin) =>
    TwinTrainingFlow(
      onboarding: CloneOnboardingController(
        transport: setup, requestId: () => _requestId,
      ),
      profileTransport: twin,
    );

void main() {
  test('interview reuses server revision and needs explicit review', () async {
    final setup = SavedSetup();
    final twin = SavedTwin();
    final flow = fixture(setup, twin);
    expect(await flow.reload(), true);
    expect(await flow.previewProfile(), false);
    expect(await flow.answer('Owner'), true);
    expect(await flow.answer('Hausa, English'), true);
    expect(await flow.answer('I teach Hausa reading.'), true);
    expect(await flow.answer('Reading, Translation'), true);
    expect(await flow.answer('Clear, Calm'), true);
    expect(flow.step, TwinInterviewStep.review);
    expect(await flow.previewProfile(), false);
    flow.setConsent(true);
    expect(await flow.previewProfile(), true);
    expect(await flow.confirmCreation(), true);
    expect(flow.ready, true);
    expect(setup.confirmations, 1);
    expect(await flow.publish(explicitlyConfirmed: true), false);
    expect(twin.applyCalls, 0);
    flow.dispose();
  });

  test('verified private test and explicit publish use existing profile CAS', () async {
    final setup = SavedSetup()..name = 'Owner'..languages = ['Hausa']..state = 'ready';
    final twin = SavedTwin();
    final flow = fixture(setup, twin);
    expect(await flow.reload(), true);
    expect(await flow.publish(explicitlyConfirmed: true), false);
    flow.setPrivateTestReviewed(true);
    expect(await flow.publish(explicitlyConfirmed: false), false);
    expect(await flow.publish(explicitlyConfirmed: true), true);
    expect(twin.previewCalls, 1);
    expect(twin.applyCalls, 1);
    flow.dispose();
  });

  test('wrong Twin owner identity never reaches publication', () async {
    final setup = SavedSetup()..name = 'Owner'..languages = ['Hausa']..state = 'ready';
    final twin = SavedTwin()..forged = true;
    final flow = fixture(setup, twin);
    await flow.reload();
    flow.setPrivateTestReviewed(true);
    expect(await flow.publish(explicitlyConfirmed: true), false);
    expect(twin.applyCalls, 0);
    expect(flow.requiresRefresh, true);
    flow.dispose();
  });

  test('uncertain commit cannot display publication success', () async {
    final setup = SavedSetup()..name = 'Owner'..languages = ['Hausa']..state = 'ready';
    final twin = SavedTwin()..uncertain = true;
    final flow = fixture(setup, twin);
    await flow.reload();
    flow.setPrivateTestReviewed(true);
    expect(await flow.publish(explicitlyConfirmed: true), false);
    expect(flow.requiresRefresh, true);
    expect(twin.public, true); // actual write may have happened
    expect(await flow.publish(explicitlyConfirmed: true), false);
    flow.dispose();
  });

  test('duplicate words and control characters rejected before Gateway write', () async {
    final setup = SavedSetup();
    final flow = fixture(setup, SavedTwin());
    await flow.reload();
    await flow.answer('Owner');
    expect(await flow.answer('Hausa, hausa'), false);
    expect(await flow.answer('Hausa\u0000'), false);
    expect(setup.languages, isEmpty);
    flow.dispose();
  });

  test('confirmed provisioning after restart resumes canonical request', () async {
    final setup = SavedSetup()
      ..name = 'Owner'
      ..languages = ['Hausa']
      ..state = 'confirmed';
    final flow = fixture(setup, SavedTwin());
    expect(await flow.reload(), true);
    expect(flow.step, TwinInterviewStep.recover);
    expect(await flow.confirmCreation(), true);
    expect(flow.ready, true);
    expect(setup.confirmations, 1);
    flow.dispose();
  });

  test('account invalidation forbids stale write and private publication', () async {
    final setup = SavedSetup()..name = 'Owner'..languages = ['Hausa']..state = 'ready';
    final twin = SavedTwin();
    final flow = fixture(setup, twin);
    await flow.reload();
    flow.setPrivateTestReviewed(true);
    flow.invalidateAccount();
    expect(await flow.publish(explicitlyConfirmed: true), false);
    expect(twin.applyCalls, 0);
    flow.dispose();
  });
}
