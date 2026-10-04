import 'package:flutter/material.dart';

import 'src/core/admin_api.dart';
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
  String? _token;
  bool _restoring = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final token = await _session.restore();
    if (!mounted) return;
    setState(() {
      _token = token;
      _restoring = false;
    });
  }

  Future<void> _authenticate(String token) async {
    await _session.save(token);
    if (mounted) setState(() => _token = token.trim());
  }

  Future<void> _signOut() async {
    await _session.clear();
    if (mounted) setState(() => _token = null);
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
            : _token == null || adminBaseUrl.trim().isEmpty
                ? AdminLoginScreen(onAuthenticated: _authenticate)
                : AdminShell(
                    api: AdminApi(token: _token!),
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
