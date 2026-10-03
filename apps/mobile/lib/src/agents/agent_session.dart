/// Agent-ready contract boundary (U-SHELL-05).
///
/// The phone is a thin shell. It never owns Characters, memory, skills,
/// tools, or workflows. When the Masanawa runtime ships, each Masana thread
/// binds to a server-owned CharacterSession (+ AgentRun per turn).
/// Until then every binding stays null and the UI runs on the civic
/// preview endpoint (`POST /ai/chat`) with an honest on-device fallback.
///
/// Rules (from Masanawa AGENT-PHONE-EMBODIMENT):
/// - Losing the phone must not lose the Character.
/// - Local threads are cache; session/run IDs are truth.
/// - Consequential actions need server Operation ID + receipt (future).
library;

/// Server-owned session binding for one Masana thread. All IDs come from
/// the Masanawa platform; the phone only holds copies for display/sync.
class AgentSessionBinding {
  const AgentSessionBinding({
    required this.masanaId,
    required this.characterSessionId,
    this.agentRunId,
  });

  /// Local thread key (`masanawa`, `labari`, …).
  final String masanaId;

  /// Canonical CharacterSession ID (server truth).
  final String characterSessionId;

  /// Latest AgentRun ID for this turn, when the runtime returns one.
  final String? agentRunId;

  Map<String, dynamic> toJson() => {
        'masanaId': masanaId,
        'characterSessionId': characterSessionId,
        if (agentRunId != null) 'agentRunId': agentRunId,
      };

  factory AgentSessionBinding.fromJson(Map<String, dynamic> json) =>
      AgentSessionBinding(
        masanaId: json['masanaId'] as String? ?? 'masanawa',
        characterSessionId: json['characterSessionId'] as String? ?? '',
        agentRunId: json['agentRunId'] as String?,
      );
}

/// Transport contract the future runtime client must implement. Kept tiny
/// on purpose: open a session, send one turn, close. No brain on device.
abstract class AgentTransport {
  /// Opens (or resumes) the server session for [masanaId].
  Future<AgentSessionBinding> openSession(String masanaId);

  /// Sends one user turn; returns the assistant text. Must throw when the
  /// runtime is unreachable so callers can fall back honestly.
  Future<String> sendTurn({
    required AgentSessionBinding binding,
    required String text,
  });

  /// Closes the local handle. Server state survives (phone ≠ brain).
  Future<void> closeSession(AgentSessionBinding binding);
}

/// Preview transport: delegates to the civic `/ai/chat` endpoint shape.
/// Replace with the real CharacterSession/AgentRun client when the
/// Masanawa platform exposes it — no UI changes required.
class PreviewAgentTransport implements AgentTransport {
  PreviewAgentTransport({required this.sendPreview});

  /// `(message, masana)` → assistant reply. Wired to `ApiClient.aiChat`.
  final Future<String> Function(String message, String masana) sendPreview;

  @override
  Future<AgentSessionBinding> openSession(String masanaId) async =>
      AgentSessionBinding(
        masanaId: masanaId,
        // Preview marker — never mistaken for a real session ID.
        characterSessionId: 'preview-$masanaId',
      );

  @override
  Future<String> sendTurn({
    required AgentSessionBinding binding,
    required String text,
  }) =>
      sendPreview(text, binding.masanaId);

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {}
}
