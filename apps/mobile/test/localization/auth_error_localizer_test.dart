import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/localization/auth_error_localizer.dart';

void main() {
  test('known auth codes use translated severity-appropriate messages', () async {
    for (final code in ['en', 'ha', 'ar', 'fr', 'es', 'pt']) {
      final l = await AppLocalizations.delegate.load(Locale(code));
      expect(
        AuthErrorLocalizer.message(l,
          code: 'OTP_INVALID', stage: AuthFailureStage.verifyCode),
        l.authCodeInvalid,
      );
      expect(
        AuthErrorLocalizer.message(l,
          code: 'OTP_LOCKED', stage: AuthFailureStage.verifyCode),
        l.authCodeLocked,
      );
      expect(
        AuthErrorLocalizer.message(l,
          code: 'OTP_EXPIRED', stage: AuthFailureStage.verifyCode),
        l.authCodeExpired,
      );
      expect(
        AuthErrorLocalizer.message(l,
          code: 'RATE_LIMITED', stage: AuthFailureStage.sendCode),
        l.authRateLimited,
      );
    }
  });

  test('unknown API failures never leak unlocalized English provider text', () async {
    final l = await AppLocalizations.delegate.load(const Locale('ar'));
    expect(
      AuthErrorLocalizer.message(l,
        code: 'UNEXPECTED_PROVIDER_INTERNAL_ERROR',
        stage: AuthFailureStage.verifyCode),
      l.authVerifyFailed,
    );
    expect(
      AuthErrorLocalizer.message(l,
        code: null, stage: AuthFailureStage.completeProfile),
      l.authProfileFailed,
    );
  });
}
