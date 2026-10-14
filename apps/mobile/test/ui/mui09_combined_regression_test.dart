// Simulated integrated shell checks; no backend/provider/device qualification.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/shell/five_tab_shell.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/finance/crypto_state.dart';
import 'package:masanawa/src/finance/crypto_wallet_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'mui08_crypto_test.dart' as crypto;

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
  void change(String id) {
    final user = AuthUser(
      id: id,
      name: 'Fixture fan',
      locale: 'en',
      status: 'ACTIVE',
      role: 'fan',
      isNewUser: false,
      createdAt: '2026-10-12T00:00:00Z',
    );
    state = SessionSignedIn(
      user,
      AuthTokens(
        accessToken: 'fixture-$id',
        refreshToken: 'fixture',
        accessExpiresIn: 900,
        user: user,
      ),
    );
  }

  void signOut() => state = const SessionSignedOut();
}

class _Chats extends AiChatController {
  @override
  AiChatState build() => const AiChatState(online: false);
}

class _Directory extends AgentDirectoryController {
  @override
  AgentDirectoryState build() => const AgentDirectoryState(loading: false);
}

class _Wallet extends WalletController {
  @override
  Future<Never> build() async => throw StateError('simulated balance outage');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    const fonts = String.fromEnvironment('MUI09_FONTS');
    if (fonts.isEmpty) return;
    const arabic = String.fromEnvironment('MUI09_ARABIC_FONT');
    for (final family in [
      'Roboto',
      'Ahem',
      'MaterialIcons',
      if (arabic.isNotEmpty) 'NotoSansArabic',
    ]) {
      final loader = FontLoader(family);
      if (family == 'NotoSansArabic') {
        loader.addFont(File(arabic).readAsBytes().then(ByteData.sublistView));
        await loader.load();
        continue;
      }
      final file = family == 'MaterialIcons'
          ? 'MaterialIcons-Regular.otf'
          : 'Roboto-Regular.ttf';
      loader.addFont(
        File('$fonts/$file').readAsBytes().then(ByteData.sublistView),
      );
      if (family != 'MaterialIcons' && arabic.isNotEmpty) {
        loader.addFont(File(arabic).readAsBytes().then(ByteData.sublistView));
      }
      await loader.load();
    }
  });
  for (final width in [320.0, 360.0, 390.0, 430.0]) {
    for (final locale in ['en', 'ha', 'ar']) {
      for (final scale in [1.0, 2.0]) {
        testWidgets(
          'combined shell $width $locale ${scale}x search/tab/embedded crypto',
          (tester) async {
            tester.view.physicalSize = Size(width, 900);
            tester.view.devicePixelRatio = 1;
            addTearDown(tester.view.resetPhysicalSize);
            addTearDown(tester.view.resetDevicePixelRatio);
            addTearDown(tester.view.resetViewInsets);
            final capture = GlobalKey();
            final session = _Session();
            Future<void> save(String screen) async {
              const folder = String.fromEnvironment('MUI09_CAPTURE');
              if (folder.isEmpty) return;
              await tester.runAsync(() async {
                final boundary =
                    capture.currentContext!.findRenderObject()!
                        as RenderRepaintBoundary;
                final image = await boundary.toImage(pixelRatio: 1);
                final bytes = await image.toByteData(
                  format: ui.ImageByteFormat.png,
                );
                await File(
                  '$folder/mui09-$width-$locale-$scale-$screen.png',
                ).writeAsBytes(bytes!.buffer.asUint8List());
                image.dispose();
              });
            }

            final router = GoRouter(
              initialLocation: '/home',
              routes: [
                GoRoute(
                  path: '/home',
                  builder: (_, state) => FiveTabShell(
                    initialIndex: switch (state.uri.queryParameters['tab']) {
                      'status' => 1,
                      'wallet' => 2,
                      'calls' => 3,
                      'rooms' => 4,
                      _ => 0,
                    },
                  ),
                ),
                GoRoute(
                  path: '/crypto',
                  builder: (_, _) => const CryptoWalletScreen(),
                ),
              ],
            );
            addTearDown(router.dispose);
            var theme = buildMasanawaTheme(brightness: Brightness.light);
            if (const String.fromEnvironment('MUI09_FONTS').isNotEmpty) {
              final navStyle = theme.navigationBarTheme.labelTextStyle!;
              theme = theme.copyWith(
                chipTheme: theme.chipTheme.copyWith(
                  labelStyle: theme.textTheme.labelLarge!.copyWith(
                    fontFamily: 'Roboto',
                    fontFamilyFallback: const ['NotoSansArabic'],
                  ),
                ),
                navigationBarTheme: theme.navigationBarTheme.copyWith(
                  labelTextStyle: WidgetStateProperty.resolveWith(
                    (states) => navStyle
                        .resolve(states)!
                        .copyWith(
                          fontFamily: 'Roboto',
                          fontFamilyFallback: const ['NotoSansArabic'],
                        ),
                  ),
                ),
                appBarTheme: theme.appBarTheme.copyWith(
                  titleTextStyle: theme.appBarTheme.titleTextStyle!.copyWith(
                    fontFamily: 'Roboto',
                  ),
                ),
              );
            }
            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  sessionProvider.overrideWith(() => session),
                  aiChatProvider.overrideWith(_Chats.new),
                  agentDirectoryProvider.overrideWith(_Directory.new),
                  walletProvider.overrideWith(_Wallet.new),
                  cryptoWalletProvider.overrideWith(
                    () => crypto.FixtureWallet(crypto.snapshot(enabled: false)),
                  ),
                  talkFeedProvider.overrideWith(
                    (ref, kind) async =>
                        throw StateError('simulated unavailable feed'),
                  ),
                ],
                child: RepaintBoundary(
                  key: capture,
                  child: MaterialApp.router(
                    theme: theme,
                    debugShowCheckedModeBanner: false,
                    locale: Locale(locale),
                    localizationsDelegates: MasanawaLocalization.delegates,
                    supportedLocales: MasanawaLocalization.supportedLocales,
                    localeListResolutionCallback:
                        MasanawaLocalization.resolvePreferred,
                    builder: (context, child) => MediaQuery(
                      data: MediaQuery.of(
                        context,
                      ).copyWith(textScaler: TextScaler.linear(scale)),
                      child: child!,
                    ),
                    routerConfig: router,
                  ),
                ),
              ),
            );
            await tester.pumpAndSettle();
            expect(
              tester
                  .widget<NavigationBar>(find.byType(NavigationBar))
                  .selectedIndex,
              0,
            );
            expect(find.byType(NavigationDestination), findsNWidgets(5));
            expect(
              Localizations.localeOf(
                tester.element(find.byType(FiveTabShell)),
              ).languageCode,
              locale,
            );
            final field = find.byType(TextField);
            await tester.enterText(field, 'no authorized match');
            await tester.pumpAndSettle();
            expect(find.byTooltip('Clear chat search'), findsOneWidget);
            session.change('fixture-a');
            await tester.pumpAndSettle();
            expect(tester.widget<TextField>(field).controller!.text, isEmpty);
            await tester.enterText(field, 'private query A');
            session.change('fixture-b');
            await tester.pumpAndSettle();
            expect(tester.widget<TextField>(field).controller!.text, isEmpty);
            await tester.enterText(field, 'private query B');
            session.signOut();
            await tester.pumpAndSettle();
            expect(tester.widget<TextField>(field).controller!.text, isEmpty);
            await tester.enterText(field, 'no authorized match');
            // Simulated software keyboard inset, not a real IME.
            tester.view.viewInsets = const FakeViewPadding(bottom: 300);
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            await save('chats-keyboard');
            await tester.tap(find.byTooltip('Clear chat search'));
            await tester.pumpAndSettle();
            expect(tester.widget<TextField>(field).controller!.text, isEmpty);
            FocusManager.instance.primaryFocus?.unfocus();
            tester.view.resetViewInsets();
            await tester.pumpAndSettle();
            Future<void> tab(int index) async {
              await tester.tap(find.byType(NavigationDestination).at(index));
              await tester.pumpAndSettle();
              expect(
                tester
                    .widget<NavigationBar>(find.byType(NavigationBar))
                    .selectedIndex,
                index,
              );
              expect(tester.takeException(), isNull);
            }

            await tab(2);
            await save('wallet-outage');
            expect(
              find.text('Wallet balances are unavailable right now.'),
              findsOneWidget,
            );
            await tester.ensureVisible(find.text('Crypto'));
            await tester.tap(find.text('Crypto'));
            await tester.pumpAndSettle();
            expect(find.byType(CryptoWalletScreen), findsOneWidget);
            // Crypto is now a section of the main Wallet, not another route.
            expect(find.byType(NavigationBar), findsOneWidget);
            await save('crypto');
            await tester.tap(find.text('Balance'));
            await tester.pumpAndSettle();
            expect(
              tester
                  .widget<NavigationBar>(find.byType(NavigationBar))
                  .selectedIndex,
              2,
            );
            await tab(3);
            await save('calls-signedout');
            expect(find.text('Sign in to see your calls.'), findsOneWidget);
            await tab(4);
            await save('rooms-unavailable');
            expect(
              find.text('Sign in to view your Rooms.'),
              findsOneWidget,
            );
            await tab(1);
            expect(find.text('Sign in to view Status updates.'), findsOneWidget);
            await save('status-unavailable');
            // Signed-out Status and Rooms remain isolated and never mount private data.
            await tab(0);
            expect(
              tester.widget<TextField>(find.byType(TextField)).controller!.text,
              isEmpty,
            );
            await save('chats');
            expect(tester.takeException(), isNull);
            await tester.pumpWidget(const SizedBox.shrink());
            await tester.pumpAndSettle();
          },
        );
      }
    }
  }
}
