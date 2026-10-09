import 'dart:async';

import 'package:flutter/foundation.dart';

import '../agents/clone_onboarding.dart';
import '../agents/twin_profile.dart';
import '../state/clone_onboarding_controller.dart';

/// A guided *presentation* of the canonical, server-persisted clone setup.
/// No Character, version, payment, media or private conversation is stored here.
enum TwinInterviewStep { name, languages, biography, expertise, style, review, recover, ready }

class TwinTrainingFlow extends ChangeNotifier {
  TwinTrainingFlow({
    required this.onboarding,
    required this.profileTransport,
  }) {
    _subscription = onboarding.changes.listen((_) {
      if (!_disposed) notifyListeners();
    });
  }

  final CloneOnboardingController onboarding;
  final TwinProfileTransport profileTransport;
  late final StreamSubscription<void> _subscription;

  TwinInterviewStep step = TwinInterviewStep.name;
  bool consentToRepresentSelf = false;
  bool reviewedPrivateTest = false;
  bool busy = false;
  bool requiresRefresh = true;
  String? error;
  bool _disposed = false;
  int _generation = 0;

  CloneOnboardingView? get view => onboarding.view;
  bool get ready => !requiresRefresh && view?.ready == true;
  String? get characterId => ready ? view?.result?.characterId : null;

  static const _questions = <TwinInterviewStep, String>{
    TwinInterviewStep.name: 'What name should your AI twin use?',
    TwinInterviewStep.languages: 'Which languages should it speak? Separate with commas.',
    TwinInterviewStep.biography: 'What may it truthfully say about your experience?',
    TwinInterviewStep.expertise: 'What subjects can it help people with? Separate with commas.',
    TwinInterviewStep.style: 'How should it speak? For example: clear, friendly.',
    TwinInterviewStep.review: 'Check your answers before confirming your Twin.',
    TwinInterviewStep.recover: 'Setup was confirmed. Recover the same request.',
    TwinInterviewStep.ready: 'Your Twin exists. Test it privately before publishing.',
  };

  String get question => _questions[step]!;

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  void choose(TwinInterviewStep value) {
    if (_disposed || busy || requiresRefresh || view?.confirmed == true) return;
    if (value == TwinInterviewStep.ready || value == TwinInterviewStep.recover) return;
    step = value;
    consentToRepresentSelf = false; // new edit invalidates consent to publish
    _changed();
  }

  void setConsent(bool value) {
    if (_disposed || busy || view?.ready == true) return;
    consentToRepresentSelf = value;
    _changed();
  }

  void setPrivateTestReviewed(bool value) {
    if (_disposed || busy || !ready) return;
    reviewedPrivateTest = value;
    _changed();
  }

  Future<bool> _run(Future<bool> Function() action, {bool uncertain = true}) async {
    if (_disposed || busy) return false;
    final captured = _generation;
    busy = true;
    error = null;
    _changed();
    try {
      final success = await action();
      if (_disposed || captured != _generation) return false;
      if (!success) {
        requiresRefresh = true;
        error = 'The server did not confirm this change. Reload saved setup.';
        return false;
      }
      requiresRefresh = false;
      return true;
    } catch (_) {
      if (!_disposed && captured == _generation) {
        if (uncertain) requiresRefresh = true;
        error = 'Status is uncertain. Reload the server before continuing.';
      }
      return false;
    } finally {
      if (!_disposed && captured == _generation) {
        busy = false;
        _changed();
      }
    }
  }

  Future<bool> reload() => _run(() async {
    if (!await onboarding.reload()) return false;
    final current = onboarding.view;
    if (current == null) return false;
    consentToRepresentSelf = false;
    reviewedPrivateTest = false;
    if (current.ready) {
      step = TwinInterviewStep.ready;
    } else if (current.confirmed) {
      step = TwinInterviewStep.recover;
    } else if (current.state == 'preview') {
      step = TwinInterviewStep.review;
    } else if (current.profile?.displayName == null) {
      step = TwinInterviewStep.name;
    } else if (current.profile!.languages.isEmpty) {
      step = TwinInterviewStep.languages;
    } else {
      // Resume by reviewing server-saved values, never assume an old
      // on-device wizard cursor accurately represents persisted changes.
      step = TwinInterviewStep.review;
    }
    return true;
  });

  static List<String> _list(String text, {required int maximum}) {
    final values = text.split(',').map((value) => value.trim()).toList();
    if (values.isEmpty || values.length > maximum ||
        values.any((value) => value.isEmpty || value.length > 120) ||
        values.map((value) => value.toLowerCase()).toSet().length != values.length) {
      throw const FormatException('Use unique, comma-separated answers.');
    }
    return values;
  }

  Future<bool> answer(String raw) async {
    if (_disposed || busy || requiresRefresh || view?.confirmed == true ||
        step == TwinInterviewStep.review) return false;
    final answer = raw.trim();
    if (answer.isEmpty || answer.length > 1000 ||
        answer.contains(RegExp(r'[\x00-\x08\x0b\x0c\x0e-\x1f]'))) {
      error = 'Please enter a shorter, readable answer.';
      _changed();
      return false;
    }
    Map<String, dynamic> patch;
    try {
      switch (step) {
        case TwinInterviewStep.name:
          if (answer.length > 120) throw const FormatException('Name too long.');
          patch = {'displayName': answer};
        case TwinInterviewStep.languages:
          patch = {'languages': _list(answer, maximum: 16)};
        case TwinInterviewStep.biography:
          patch = {'biography': answer};
        case TwinInterviewStep.expertise:
          patch = {'expertise': _list(answer, maximum: 32)};
        case TwinInterviewStep.style:
          patch = {'personality': _list(answer, maximum: 24)};
        default:
          return false;
      }
    } on FormatException catch (e) {
      error = e.message;
      _changed();
      return false;
    }
    final selected = step;
    final accepted = await _run(() => onboarding.save(patch));
    if (accepted) {
      step = switch (selected) {
        TwinInterviewStep.name => TwinInterviewStep.languages,
        TwinInterviewStep.languages => TwinInterviewStep.biography,
        TwinInterviewStep.biography => TwinInterviewStep.expertise,
        TwinInterviewStep.expertise => TwinInterviewStep.style,
        _ => TwinInterviewStep.review,
      };
      consentToRepresentSelf = false;
      _changed();
    }
    return accepted;
  }

  Future<bool> previewProfile() async {
    if (_disposed || requiresRefresh || !consentToRepresentSelf ||
        view?.confirmed == true) return false;
    final saved = await _run(() => onboarding.preview());
    if (saved) step = TwinInterviewStep.review;
    return saved;
  }

  Future<bool> confirmCreation() async {
    if (_disposed || requiresRefresh ||
        (view?.state != 'preview' && view?.state != 'confirmed') ||
        (view?.state == 'preview' && !consentToRepresentSelf)) return false;
    final saved = await _run(() => onboarding.confirm());
    if (saved) step = view?.ready == true ? TwinInterviewStep.ready : TwinInterviewStep.recover;
    return saved;
  }

  /// Uses the EXISTING CAS TwinProfile endpoint. Explicit preview and consent
  /// never substitute for Character/owner or funds authorization on the server.
  Future<bool> publish({required bool explicitlyConfirmed}) async {
    if (_disposed || busy || !ready || !reviewedPrivateTest ||
        !explicitlyConfirmed || characterId == null) return false;
    return _run(() async {
      final expectedCharacter = characterId;
      final current = await profileTransport.load();
      if (!current.hasTwin || current.characterId != expectedCharacter) return false;
      if (current.discoverable) return true;
      final proposal = await profileTransport.previewCustomization(
        const TwinProfileCustomizationPatch(discoverable: true),
      );
      if (proposal.patch.discoverable != true ||
          proposal.currentRevision < 1 ||
          !proposal.requiresConfirmation ||
          !proposal.standingChanges.contains('publish-profile')) return false;
      final applied = await profileTransport.applyCustomization(
        preview: proposal,
        confirmed: true,
      );
      if (applied.characterId != expectedCharacter || !applied.discoverable) return false;
      final verified = await profileTransport.load();
      return verified.hasTwin &&
          verified.characterId == expectedCharacter &&
          verified.discoverable;
    });
  }

  /// A session switch invalidates all old replies; never reuse an old review.
  void invalidateAccount() {
    if (_disposed) return;
    _generation++;
    requiresRefresh = true;
    consentToRepresentSelf = false;
    reviewedPrivateTest = false;
    error = null;
    _changed();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _generation++;
    _subscription.cancel();
    onboarding.dispose();
    super.dispose();
  }
}
