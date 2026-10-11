import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/features/masana_chat/masana_chats_list_api.dart';
import 'package:masanawa/src/features/masana_chat/masana_chats_list_screen.dart';

class InboxFake implements MasanaInboxAccess {
  final List<String> scopes=[];
  final chat=const MasanaInboxItem(
    characterId:'character_0199f0d0-0000-7000-8000-000000000003',
    displayName:'Gwana',profession:'Teacher',lastMessage:'Salaam',
    lastActivityAt:'2026-10-11',pinned:false,unreadCount:2,revision:0);
  @override Future<List<MasanaInboxItem>> readCache(String accountId) async {
    scopes.add('cache:$accountId');return [chat];
  }
  @override Future<List<MasanaInboxItem>> load(String accountId,
    {String query=''}) async {
    scopes.add('load:$accountId:$query');return [chat];
  }
  @override Future<int> pin(String id,bool pinned,int revision) async {
    scopes.add('pin:$revision:$pinned');return revision+1;
  }
  @override Future<void> markRead(String id) async {
    scopes.add('read:$id');
  }
}
void main(){
  testWidgets('C10 shows authenticated Masana and private unread state',
    (tester)async{
    final api=InboxFake();
    String? opened;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates:AppLocalizations.localizationsDelegates,
      supportedLocales:AppLocalizations.supportedLocales,
      home:MasanaChatsListScreen(
      accountId:'fan-a',inbox:api,
      onOpen:(id,name)=>opened='$id/$name')));
    await tester.pumpAndSettle();
    expect(find.text('Gwana'),findsOneWidget);
    expect(find.text('Salaam'),findsOneWidget);
    expect(find.text('2'),findsOneWidget);
    await tester.tap(find.byTooltip('Pin chat'));
    await tester.pumpAndSettle();
    expect(api.scopes,contains('pin:0:true'));
    await tester.tap(find.text('Gwana'));
    await tester.pumpAndSettle();
    expect(opened,contains('Gwana'));
    expect(api.scopes.any((e)=>e.startsWith('read:')),isTrue);
  });
  testWidgets('account switch reads a distinct secure cache key', (tester)async{
    final api=InboxFake();
    Widget screen(String id)=>MaterialApp(
      localizationsDelegates:AppLocalizations.localizationsDelegates,
      supportedLocales:AppLocalizations.supportedLocales,
      home:MasanaChatsListScreen(
      accountId:id,inbox:api,onOpen:(_,__){}));
    await tester.pumpWidget(screen('fan-a'));await tester.pumpAndSettle();
    await tester.pumpWidget(screen('fan-b'));await tester.pumpAndSettle();
    expect(api.scopes,contains('cache:fan-a'));
    expect(api.scopes,contains('cache:fan-b'));
  });
}
