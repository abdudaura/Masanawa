import 'creator_clone.dart';

class CloneSetupProfile {
  const CloneSetupProfile({
    required this.displayName,
    required this.biography,
    required this.languages,
    required this.personality,
    required this.expertise,
  });
  final String? displayName;
  final String biography;
  final List<String> languages, personality, expertise;

  factory CloneSetupProfile.fromJson(Map<String, dynamic> json) {
    String text(String key, int limit) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty || value.length > limit)
        throw const FormatException('Invalid clone profile');
      return value;
    }

    List<String> list(String key, int maximum, {bool empty = false}) {
      final value = json[key];
      if (value is! List ||
          value.length > maximum ||
          (!empty && value.isEmpty) ||
          value.any(
            (item) =>
                item is! String || item.trim().isEmpty || item.length > 120,
          ))
        throw const FormatException('Invalid clone profile');
      return List.unmodifiable(value.cast<String>());
    }

    final name = json['displayName'];
    if (name != null &&
        (name is! String || name.trim().isEmpty || name.length > 120))
      throw const FormatException('Invalid clone name');
    return CloneSetupProfile(
      displayName: name as String?,
      biography: text('biography', 1000),
      languages: list('languages', 16, empty: true),
      personality: list('personality', 24),
      expertise: list('expertise', 32),
    );
  }
}

class CloneOnboardingView {
  const CloneOnboardingView({
    required this.revision,
    required this.state,
    required this.profile,
    required this.confirmationRequestId,
    required this.confirmationPreviewRevision,
    required this.result,
    required this.prompt,
  });
  final int? revision;
  final String? state;
  final CloneSetupProfile? profile;
  final String? confirmationRequestId;
  final int? confirmationPreviewRevision;
  final CreatorCloneResult? result;
  final String prompt;
  bool get confirmed => state == 'confirmed' || state == 'ready';
  bool get ready => state == 'ready';

  factory CloneOnboardingView.fromJson(Map<String, dynamic> json) {
    final prompt = json['prompt'];
    if (prompt is! String ||
        prompt.isEmpty ||
        prompt.length > 1000 ||
        json['runtimeReadiness'] != 'not-verified')
      throw const FormatException('Invalid clone setup response');
    final setup = json['setup'];
    if (setup == null)
      return CloneOnboardingView(
        revision: null,
        state: null,
        profile: null,
        confirmationRequestId: null,
        confirmationPreviewRevision: null,
        result: null,
        prompt: prompt,
      );
    if (setup is! Map)
      throw const FormatException('Invalid clone setup response');
    final state = setup['state'];
    final revision = setup['revision'];
    final profile = setup['profile'];
    final requestId = setup['confirmationRequestId'];
    final previewRevision = setup['confirmationPreviewRevision'];
    final result = setup['result'];
    if (!{
          'editing',
          'preview',
          'confirmed',
          'ready',
          'cancelled',
        }.contains(state) ||
        revision is! int ||
        revision < 1 ||
        revision > 9007199254740991 ||
        profile is! Map)
      throw const FormatException('Invalid clone setup response');
    final confirmed = state == 'confirmed' || state == 'ready';
    if (confirmed) {
      if (requestId is! String ||
          !isCloneConfirmationRequestId(requestId) ||
          previewRevision is! int ||
          previewRevision < 1 ||
          previewRevision >= revision)
        throw const FormatException('Invalid clone confirmation');
    } else if (requestId != null || previewRevision != null) {
      throw const FormatException('Invalid clone confirmation');
    }
    if ((state == 'ready' && result is! Map) ||
        (state != 'ready' && result != null))
      throw const FormatException('Invalid clone result');
    if (result is Map) {
      for (final entry in {
        'characterId': 'character',
        'characterVersionId': 'character-version',
        'relationshipId': 'relationship',
      }.entries) {
        final value = result[entry.key];
        if (value is! String ||
            !isCloneConfirmationRequestId(
              value.replaceFirst('${entry.value}_', 'request_'),
            ) ||
            !value.startsWith('${entry.value}_')) {
          throw const FormatException('Invalid canonical clone result');
        }
      }
      if (result['created'] is! bool ||
          result['displayName'] is! String ||
          (result['displayName'] as String).trim().isEmpty ||
          (result['displayName'] as String).length > 120) {
        throw const FormatException('Invalid clone result');
      }
    }
    final parsed = CloneSetupProfile.fromJson(profile.cast<String, dynamic>());
    if ({'preview', 'confirmed', 'ready'}.contains(state) &&
        (parsed.displayName == null || parsed.languages.isEmpty))
      throw const FormatException('Incomplete clone preview');
    return CloneOnboardingView(
      revision: revision,
      state: state as String,
      profile: parsed,
      confirmationRequestId: requestId as String?,
      confirmationPreviewRevision: previewRevision as int?,
      result: result == null
          ? null
          : CreatorCloneResult.fromJson(
              (result as Map).cast<String, dynamic>(),
            ),
      prompt: prompt,
    );
  }
}

bool isCloneConfirmationRequestId(String value) => RegExp(
  r'^request_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
).hasMatch(value);

abstract class CloneOnboardingTransport {
  Future<CloneOnboardingView> read();
  Future<CloneOnboardingView> save({
    required int? expectedRevision,
    required Map<String, dynamic> profile,
  });
  Future<CloneOnboardingView> preview(int expectedRevision);
  Future<CloneOnboardingView> confirm({
    required int expectedPreviewRevision,
    required String requestId,
  });
  Future<CloneOnboardingView> cancel(int expectedRevision);
}
