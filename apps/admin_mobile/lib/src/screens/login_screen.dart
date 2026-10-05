import 'package:flutter/material.dart';

import '../core/admin_auth_api.dart';
import '../theme/masanawa_theme.dart';

class AdminLoginScreen extends StatefulWidget {
  const AdminLoginScreen({super.key, required this.onAuthenticated});
  final Future<void> Function(AdminAuthTokens tokens) onAuthenticated;

  @override
  State<AdminLoginScreen> createState() => _AdminLoginScreenState();
}

class _AdminLoginScreenState extends State<AdminLoginScreen> {
  final _identifier = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _auth = AdminAuthApi();

  bool _codeSent = false;
  bool _busy = false;
  bool _nameRequired = false;
  String? _error;

  Future<void> _sendCode() async {
    final identifier = _identifier.text.trim();
    if (identifier.isEmpty) {
      setState(() => _error = 'Enter your admin email address or phone number.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _auth.sendOtp(identifier);
      if (mounted) {
        setState(() {
          _codeSent = true;
          _nameRequired = false;
        });
      }
    } on AdminAuthException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'Enter the 6-digit sign-in code.');
      return;
    }
    if (_nameRequired && _name.text.trim().isEmpty) {
      setState(() => _error = 'Enter your name to finish creating the account.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final tokens = await _auth.verifyOtp(
        identifier: _identifier.text,
        code: _code.text,
        name: _nameRequired ? _name.text : null,
      );
      await widget.onAuthenticated(tokens);
    } on AdminAuthException catch (error) {
      if (mounted) {
        setState(() {
          _nameRequired = error.code == 'NAME_REQUIRED_ON_SIGNUP';
          _error = error.message;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _identifier.dispose();
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Image.asset(
                      'assets/brand/masanawa_agent_logo.png',
                      width: 82,
                      height: 82,
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text(
                    'Masanawa Admin',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in with your Masanawa operator account.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: colors.textMuted),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _identifier,
                    enabled: !_codeSent && !_busy,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [
                      AutofillHints.email,
                      AutofillHints.telephoneNumber,
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Email or phone',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    onSubmitted: (_) => _codeSent ? _verify() : _sendCode(),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: 14),
                    TextField(
                      controller: _code,
                      enabled: !_busy,
                      keyboardType: TextInputType.number,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: '6-digit code',
                        prefixIcon: Icon(Icons.password_outlined),
                        counterText: '',
                      ),
                      onSubmitted: (_) => _verify(),
                    ),
                  ],
                  if (_nameRequired) ...[
                    const SizedBox(height: 14),
                    TextField(
                      controller: _name,
                      enabled: !_busy,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Your name',
                        prefixIcon: Icon(Icons.badge_outlined),
                      ),
                      onSubmitted: (_) => _verify(),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: TextStyle(color: colors.emergency)),
                  ],
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: _busy
                        ? null
                        : _codeSent
                            ? _verify
                            : _sendCode,
                    icon: _busy
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            _codeSent
                                ? Icons.verified_user_outlined
                                : Icons.mark_email_read_outlined,
                          ),
                    label: Text(
                      _busy
                          ? 'Working…'
                          : _codeSent
                              ? 'Verify and open admin'
                              : 'Send sign-in code',
                    ),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () {
                              setState(() {
                                _codeSent = false;
                                _nameRequired = false;
                                _code.clear();
                                _name.clear();
                                _error = null;
                              });
                            },
                      child: const Text('Use a different account'),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(
                    'Only accounts granted Ops capabilities by the server can enter.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.textMuted,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
