import 'package:flutter/material.dart';

import 'src/core/admin_api.dart';
import 'src/core/admin_auth_api.dart';
import 'src/core/admin_session.dart';
import 'src/screens/admin_shell.dart';
import 'src/screens/login_screen.dart';
import 'src/theme/masanawa_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MasanawaAdminApp());
}

class MasanawaAdminApp extends StatefulWidget {
  const MasanawaAdminApp({super.key});

  @override
  State<MasanawaAdminApp> createState() => _MasanawaAdminAppState();
}

class _MasanawaAdminAppState extends State<MasanawaAdminApp> {
  final _session = AdminSession();
  final _auth = AdminAuthApi();

  String? _accessToken;
  String? _refreshToken;
  bool _restoring = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final stored = await _session.restore();
    if (stored == null) {
      if (mounted) setState(() => _restoring = false);
      return;
    }

    try {
      final refreshed = await _auth.refresh(stored.refreshToken);
      await _persist(refreshed);
      await AdminApi(
        token: refreshed.accessToken,
        refreshAccessToken: _refreshAccessToken,
      ).platformSummary();
    } catch (_) {
      await _session.clear();
      _accessToken = null;
      _refreshToken = null;
    } finally {
      if (mounted) setState(() => _restoring = false);
    }
  }

  Future<void> _persist(AdminAuthTokens tokens) async {
    await _session.save(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );
    _accessToken = tokens.accessToken;
    _refreshToken = tokens.refreshToken;
  }

  Future<void> _authenticate(AdminAuthTokens tokens) async {
    await AdminApi(token: tokens.accessToken).platformSummary();
    await _persist(tokens);
    if (mounted) setState(() {});
  }

  Future<String?> _refreshAccessToken() async {
    final refresh = _refreshToken;
    if (refresh == null || refresh.isEmpty) return null;
    try {
      final tokens = await _auth.refresh(refresh);
      await _persist(tokens);
      return tokens.accessToken;
    } catch (_) {
      await _session.clear();
      _accessToken = null;
      _refreshToken = null;
      if (mounted) setState(() {});
      return null;
    }
  }

  Future<void> _signOut() async {
    final access = _accessToken;
    if (access != null && access.isNotEmpty) {
      await _auth.logout(access);
    }
    await _session.clear();
    if (mounted) {
      setState(() {
        _accessToken = null;
        _refreshToken = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Masanawa Admin',
        debugShowCheckedModeBanner: false,
        theme: buildMasanawaTheme(brightness: Brightness.light),
        darkTheme: buildMasanawaTheme(brightness: Brightness.dark),
        themeMode: ThemeMode.system,
        home: _restoring
            ? const _Splash()
            : _accessToken == null ||
                    adminBaseUrl.trim().isEmpty ||
                    adminAuthBaseUrl.trim().isEmpty
                ? AdminLoginScreen(onAuthenticated: _authenticate)
                : AdminShell(
                    api: AdminApi(
                      token: _accessToken!,
                      refreshAccessToken: _refreshAccessToken,
                    ),
                    onSignOut: _signOut,
                  ),
      );
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Image.asset(
            'assets/brand/masanawa_agent_logo.png',
            width: 88,
            height: 88,
          ),
        ),
      );
}
