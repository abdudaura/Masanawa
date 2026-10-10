import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api/models.dart';
import '../core/network/api_client.dart';
import '../core/phone/country_codes.dart';
import '../ui/components/phone_field.dart';
import 'phone_password_transport.dart';

/// AF08-owned form. AF00 mounts this in the existing onboarding shell and
/// passes the canonical SessionController token persistence callback.
class PhonePasswordForm extends StatefulWidget {
  const PhonePasswordForm({
    super.key,
    required this.transport,
    required this.onAuthenticated,
    required this.onUseEmail,
  });

  final PhonePasswordTransport transport;
  final Future<void> Function(AuthTokens tokens) onAuthenticated;
  final VoidCallback onUseEmail;

  @override
  State<PhonePasswordForm> createState() => _PhonePasswordFormState();
}

class _PhonePasswordFormState extends State<PhonePasswordForm> {
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;
  bool _showPassword = false;
  String? _error;

  String _t(String english, String hausa) =>
      Localizations.localeOf(context).languageCode == 'ha' ? hausa : english;

  @override
  void dispose() {
    _phone.dispose();
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  String _message(String? code) => switch (code) {
        'PHONE_INVALID' => _t('Check your phone number and country code.',
            'Duba lambar waya da lambar ƙasa.'),
        'PASSWORD_INVALID' => _t('Use 8–16 unpredictable digits.',
            'Yi amfani da lambobi 8–16 masu wuyar hasashe.'),
        'NAME_REQUIRED_ON_SIGNUP' => _t('Enter your name to sign up.',
            'Shigar da sunanka domin yin rajista.'),
        'PHONE_ALREADY_REGISTERED' => _t(
            'This number is already registered. Sign in or use account support.',
            'An riga an yi rajista da wannan lambar. Shiga ko nemi taimako.'),
        'INVALID_CREDENTIALS' => _t('Phone or password is incorrect.',
            'Lambar waya ko kalmar sirri ba daidai ba ce.'),
        'PASSWORD_RATE_LIMITED' => _t(
            'Too many attempts. Try again later.',
            'An yi ƙoƙari da yawa. Sake gwadawa daga baya.'),
        _ => _t('Sign-in is unavailable. Check your connection and retry.',
            'Ba a iya shiga yanzu. Duba intanet ka sake gwadawa.'),
      };

  Future<void> _submit() async {
    if (_busy) return;
    final phone = normalizeE164(_phone.text);
    final length = phone.replaceAll(RegExp(r'\D'), '').length;
    if (length < 7 || length > 15) {
      setState(() => _error = 'PHONE_INVALID');
      return;
    }
    if (!RegExp(r'^\d{8,16}$').hasMatch(_password.text)) {
      setState(() => _error = 'PASSWORD_INVALID');
      return;
    }
    if (_register && _name.text.trim().isEmpty) {
      setState(() => _error = 'NAME_REQUIRED_ON_SIGNUP');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final tokens = _register
          ? await widget.transport.register(
              phone: phone,
              password: _password.text,
              name: _name.text.trim(),
            )
          : await widget.transport.login(
              phone: phone,
              password: _password.text,
            );
      if (!mounted) return;
      await widget.onAuthenticated(tokens);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.code ?? 'AUTH_UNAVAILABLE');
    } catch (_) {
      if (mounted) setState(() => _error = 'AUTH_UNAVAILABLE');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: _t('Account access method', 'Hanyar shiga asusu'),
          child: SegmentedButton<bool>(
            segments: [
              ButtonSegment(
                value: false, label: Text(_t('Log in', 'Shiga')),
              ),
              ButtonSegment(
                value: true, label: Text(_t('Sign up', 'Rajista')),
              ),
            ],
            selected: {_register},
            onSelectionChanged: _busy ? null : (selected) {
              setState(() {
                _register = selected.first;
                _error = null;
              });
            },
          ),
        ),
        const SizedBox(height: 20),
        PhoneField(controller: _phone, autofocus: false),
        if (_register) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            enabled: !_busy,
            textCapitalization: TextCapitalization.words,
            autofillHints: const [AutofillHints.name],
            decoration: InputDecoration(
              labelText: _t('Your name', 'Sunanka'),
              border: const OutlineInputBorder(),
            ),
          ),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _password,
          enabled: !_busy,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(16)],
          obscureText: !_showPassword,
          autofillHints: const [AutofillHints.password],
          decoration: InputDecoration(
            labelText: _t('Numeric password', 'Kalmar sirri ta lambobi'),
            helperText: _t('8–16 digits, not a simple sequence',
                'Lambobi 8–16, ba jerin masu sauƙi ba'),
            border: const OutlineInputBorder(),
            suffixIcon: IconButton(
              onPressed: () => setState(() => _showPassword = !_showPassword),
              tooltip: _showPassword
                  ? _t('Hide password', 'Ɓoye kalmar sirri')
                  : _t('Show password', 'Nuna kalmar sirri'),
              icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          _t('Your phone number is not verified. It cannot be used by itself for account recovery or financial verification.',
              'Ba a tabbatar da lambar wayarka ba. Ba za a iya amfani da ita kaɗai wajen dawo da asusu ko tabbatar da kuɗi ba.'),
          style: theme.textTheme.bodySmall,
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_message(_error), key: const Key('phonePasswordError'),
              style: TextStyle(color: theme.colorScheme.error)),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_register ? _t('Create account', 'Ƙirƙiri asusu')
                  : _t('Log in', 'Shiga')),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _busy ? null : widget.onUseEmail,
          child: Text(_t('Use email instead', 'Yi amfani da imel maimakon haka')),
        ),
      ],
    );
  }
}
