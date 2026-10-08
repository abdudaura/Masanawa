import '../../l10n/app_localizations.dart';

enum AuthFailureStage { capabilities, sendCode, verifyCode, completeProfile }

/// Server error codes are stable machine data; provider-supplied English
/// messages are never rendered as UI localization. Unknown codes receive an
/// honest, actionable localized fallback for the current auth operation.
abstract final class AuthErrorLocalizer {
  static String message(
    AppLocalizations l10n, {
    required String? code,
    required AuthFailureStage stage,
  }) {
    return switch (code) {
      'OTP_INVALID' => l10n.authCodeInvalid,
      'OTP_LOCKED' => l10n.authCodeLocked,
      'OTP_EXPIRED' => l10n.authCodeExpired,
      'OTP_RATE_LIMITED' || 'RATE_LIMITED' || 'TOO_MANY_REQUESTS' =>
        l10n.authRateLimited,
      'AUTH_UNAVAILABLE' => l10n.signInMethodsUnavailable,
      _ => switch (stage) {
        AuthFailureStage.capabilities => l10n.signInMethodsLoadFailed,
        AuthFailureStage.sendCode => l10n.authSendFailed,
        AuthFailureStage.verifyCode => l10n.authVerifyFailed,
        AuthFailureStage.completeProfile => l10n.authProfileFailed,
      },
    };
  }
}
