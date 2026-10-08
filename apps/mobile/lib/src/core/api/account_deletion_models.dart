/// Server-authoritative deletion request projection. Neither verification nor
/// a pending request means personal data has been erased.
class AccountDeletionRequestView {
  const AccountDeletionRequestView({
    required this.requestId,
    required this.phase,
    required this.createdAt,
    required this.updatedAt,
    required this.revision,
  });

  final String requestId;
  final String phase;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int revision;

  bool get needsVerification => phase == 'requested';
  bool get finished => phase == 'completed';

  static const allowedPhases = {
    'requested', 'identity-verified', 'awaiting-settlement',
    'processing', 'completed', 'failed',
  };

  factory AccountDeletionRequestView.fromJson(Map<String, dynamic> json) {
    final requestId = json['requestId'];
    final phase = json['phase'];
    final revision = json['revision'];
    final createdAt = DateTime.tryParse(json['createdAt']?.toString() ?? '');
    final updatedAt = DateTime.tryParse(json['updatedAt']?.toString() ?? '');
    if (requestId is! String || requestId.isEmpty ||
        phase is! String || !allowedPhases.contains(phase) ||
        revision is! int || revision < 1 ||
        createdAt == null || updatedAt == null) {
      throw const FormatException('Invalid account deletion response');
    }
    return AccountDeletionRequestView(
      requestId: requestId,
      phase: phase,
      createdAt: createdAt,
      updatedAt: updatedAt,
      revision: revision,
    );
  }
}

class AccountDeletionDeliveryView {
  const AccountDeletionDeliveryView({
    required this.request,
    required this.verificationSent,
    required this.verificationChannel,
  });

  final AccountDeletionRequestView request;
  final bool verificationSent;
  final String? verificationChannel;

  factory AccountDeletionDeliveryView.fromJson(Map<String, dynamic> json) {
    final request = json['request'];
    final sent = json['verificationSent'];
    final channel = json['verificationChannel'];
    if (request is! Map || sent is! bool ||
        (channel != null && channel != 'email' && channel != 'sms')) {
      throw const FormatException('Invalid deletion verification response');
    }
    return AccountDeletionDeliveryView(
      request: AccountDeletionRequestView.fromJson(
        Map<String, dynamic>.from(request),
      ),
      verificationSent: sent,
      verificationChannel: channel as String?,
    );
  }
}
