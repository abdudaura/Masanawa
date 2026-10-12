import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/shell/five_tab_shell.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:masanawa/src/screens/chat/chat_list_screen.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/masanawa_wordmark.dart';
import 'package:masanawa/src/ui/components/masanawa_main_header.dart';
import 'package:masanawa/src/ui/components/conversation_search_field.dart';

class _OfflineChats extends AiChatController {
  @override
  AiChatState build() => const AiChatState(online: false);
}

class _Directory extends AgentDirectoryController {
  @override
  AgentDirectoryState build() => const AgentDirectoryState(loading: false);
}

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

void main() {
  test('navigation distinguishes green selection from neutral text', () {
    final theme = buildMasanawaTheme(brightness: Brightness.light);
    final colors = theme.extension<MasanawaColors>()!;
    final nav = theme.navigationBarTheme;
    expect(nav.iconTheme!.resolve({WidgetState.selected})!.color, colors.brand);
    expect(nav.iconTheme!.resolve({})!.color, colors.textPrimary);
    expect(
      nav.labelTextStyle!.resolve({WidgetState.selected})!.color,
      colors.textPrimary,
    );
    expect(nav.labelTextStyle!.resolve({})!.color, colors.textPrimary);
    expect(nav.labelTextStyle!.resolve({})!.fontWeight, FontWeight.w600);
    expect(
      nav.labelTextStyle!.resolve({WidgetState.selected})!.fontWeight,
      FontWeight.w700,
    );
  });

  testWidgets('wordmark is balanced and readable on white', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const Scaffold(body: MasanawaWordmark()),
      ),
    );
    final text = tester.widget<Text>(find.text('Masanawa'));
    expect(text.style!.color, const Color(0xFF075E54));
    expect(text.style!.fontSize, 24);
    expect(text.style!.fontWeight, FontWeight.w700);
    expect(text.style!.letterSpacing, 0);
  });

  for (final width in [320.0, 360.0, 390.0, 430.0]) {
    for (final direction in TextDirection.values) {
      testWidgets(
        'header actions remain reachable at $width $direction 2x text',
        (tester) async {
          tester.view.physicalSize = Size(width, 800);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          var opened = false;
          await tester.pumpWidget(
            MaterialApp(
              theme: buildMasanawaTheme(brightness: Brightness.light),
              home: Builder(
                builder: (context) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: TextScaler.linear(2)),
                  child: Directionality(
                    textDirection: direction,
                    child: Builder(
                      builder: (context) => Scaffold(
                        appBar: masanawaMainHeader(
                          context,
                          actions: [
                            for (var i = 0; i < 4; i++)
                              IconButton(
                                tooltip: 'Action $i',
                                icon: const Icon(Icons.settings),
                                onPressed: () => opened = true,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          final header = tester.widget<AppBar>(find.byType(AppBar));
          expect(header.backgroundColor, Colors.white);
          expect(header.automaticallyImplyLeading, false);
          expect(find.text('Masanawa'), findsOneWidget);
          expect(tester.takeException(), isNull);
          await tester.tap(find.byType(PopupMenuButton<int>));
          await tester.pumpAndSettle();
          expect(find.text('Action 3'), findsOneWidget);
          await tester.tap(find.text('Action 3'));
          await tester.pumpAndSettle();
          expect(opened, isTrue);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }

  testWidgets(
    'shared search responds to typing, programmatic updates and clear',
    (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      String? query;
      var cleared = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          home: Scaffold(
            body: ConversationSearchField(
              controller: controller,
              hintText: 'Search conversations',
              onChanged: (value) => query = value,
              onClear: () => cleared = true,
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.clear), findsNothing);
      await tester.enterText(find.byType(TextField), 'Amina');
      await tester.pump();
      expect(query, 'Amina');
      expect(find.byIcon(Icons.clear), findsOneWidget);
      await tester.tap(find.byIcon(Icons.clear));
      await tester.pump();
      expect(controller.text, isEmpty);
      expect(cleared, isTrue);
      expect(find.byIcon(Icons.clear), findsNothing);
      controller.text = 'Bello';
      await tester.pump();
      expect(find.byIcon(Icons.clear), findsOneWidget);
      final rect = tester.getRect(find.byType(TextField));
      expect(rect.height, inInclusiveRange(44, 48));
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.decoration!.fillColor, const Color(0xFFF0F2F5));
      expect(field.decoration!.enabledBorder!.borderSide, BorderSide.none);
    },
  );

  testWidgets(
    'Chats offline strip stays within its header at 320px with 2x text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiChatProvider.overrideWith(_OfflineChats.new),
            agentDirectoryProvider.overrideWith(_Directory.new),
            sessionProvider.overrideWith(_Session.new),
          ],
          child: MaterialApp(
            theme: buildMasanawaTheme(brightness: Brightness.light),
            home: Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(2)),
                child: const ChatListScreen(),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final message = find.text('Offline · cached conversations available');
      expect(
        tester.getRect(message).bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(AppBar)).bottom),
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('root navigation paints a visible surface separator', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final capture = GlobalKey();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          aiChatProvider.overrideWith(_OfflineChats.new),
          agentDirectoryProvider.overrideWith(_Directory.new),
          sessionProvider.overrideWith(_Session.new),
        ],
        child: MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: RepaintBoundary(key: capture, child: const FiveTabShell()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final top = tester.getTopLeft(find.byType(NavigationBar)).dy.toInt();
    await tester.runAsync(() async {
      final image =
          await (capture.currentContext!.findRenderObject()!
                  as RenderRepaintBoundary)
              .toImage();
      final data = (await image.toByteData(
        format: ui.ImageByteFormat.rawRgba,
      ))!;
      final pixel = (top * image.width + image.width ~/ 2) * 4;
      expect(data.buffer.asUint8List(pixel, 4), [233, 237, 239, 255]);
      image.dispose();
    });
    expect(tester.takeException(), isNull);
  });
}
