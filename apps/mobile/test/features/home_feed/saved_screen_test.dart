import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/home_feed/saved_api.dart';
import 'package:masanawa/src/features/home_feed/saved_screen.dart';

class MemorySavedApi implements SavedLibraryApi {
  MemorySavedApi(this.pages);
  final List<SavedPage> pages;
  int calls=0;
  @override Future<SavedPage> list({String? cursor}) async { calls++; return pages.first; }
  @override Future<void> unsave(SavedEntry item) async {}
  @override Future<void> saveVideo(String id,bool enabled) async {}
}
void main() {
  testWidgets('C25 empty, retry and switched account never show previous fan rows',(tester) async {
    final a=MemorySavedApi([const SavedPage(items:[],nextCursor:null)]);
    final b=MemorySavedApi([const SavedPage(items:[],nextCursor:null)]);
    Widget screen(SavedLibraryApi api,String account)=>MaterialApp(home:Scaffold(
      body:MasanaSavedScreen(api:api,accountKey:account)));
    await tester.pumpWidget(screen(a,'fan-a'));await tester.pumpAndSettle();
    expect(find.text('Nothing saved yet'),findsOneWidget);
    expect(a.calls,1);
    await tester.pumpWidget(screen(b,'fan-b'));await tester.pumpAndSettle();
    expect(b.calls,1);
    expect(find.text('Nothing saved yet'),findsOneWidget);
    await tester.tap(find.text('Refresh'));await tester.pumpAndSettle();
    expect(b.calls,2);
  });
  testWidgets('C25 feature-disabled is explicit',(tester) async {
    final api=MemorySavedApi([const SavedPage(items:[],nextCursor:null)]);
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaSavedScreen(
      api:api,accountKey:'fan',enabled:false))));
    await tester.pumpAndSettle();
    expect(find.text('Saved is unavailable'),findsOneWidget);
    expect(api.calls,0);
  });
}
