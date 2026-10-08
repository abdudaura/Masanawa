import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/finance/internal_crypto_transfer.dart';
import 'package:masanawa/src/finance/internal_crypto_transfer_screen.dart';
import 'package:masanawa/src/state/session_state.dart';

class _SessionStub extends SessionController {
  @override
  SessionState build() {
    final user=AuthUser(id:'user_test',name:'Tester',locale:'en',
      status:'ACTIVE',role:'user',isNewUser:false,createdAt:'2026-10-08T00:00:00Z');
    return SessionSignedIn(user,AuthTokens(
      accessToken:'token',refreshToken:'refresh',accessExpiresIn:3600,user:user));
  }
}
class _JournalStub extends InternalCryptoTransferJournal {
  String? saved;
  @override
  Future<String?> pendingRequest(String ownerId) async => saved;
  @override
  Future<String> begin(String ownerId) async {
    saved ??= 'request_0199f499-8c22-7a12-9a18-07a317745bbb';
    return saved!;
  }
  @override
  Future<void> clear(String ownerId) async { saved=null; }
}
class _TransferStub implements InternalCryptoTransferTransport {
  int confirmCount=0;
  int quoteCount=0;
  InternalCryptoTransferQuote? current;
  InternalCryptoTransferQuote receipt(String id,{bool done=false,bool token=true}) =>
    InternalCryptoTransferQuote(requestId:id,recipientLabel:'friend@example.com',
      asset:'USDT',network:'tron',amount:'2',fee:'0',
      status:done?'completed':'quoted',
      expiresAt:DateTime.utc(2099),
      completedAt:done?DateTime.utc(2026,10,8):null,
      confirmationToken:token?'a'.padRight(64,'a'):null);
  @override
  Future<InternalCryptoTransferQuote> quote({required String requestId,
    required String recipient,required String providerCode,
    required String amount})async{
    quoteCount++;
    return current=receipt(requestId);
  }
  @override
  Future<InternalCryptoTransferQuote?> read(String requestId)async=>current;
  @override
  Future<InternalCryptoTransferQuote> confirm(String requestId,String confirmationToken)async{
    confirmCount++;
    return current=receipt(requestId,done:true,token:false);
  }
}
Future<void> mount(WidgetTester tester,_JournalStub journal,_TransferStub transfer) async{
  await tester.pumpWidget(ProviderScope(overrides:[
    sessionProvider.overrideWith(_SessionStub.new),
    internalCryptoTransferJournalProvider.overrideWithValue(journal),
    internalCryptoTransferTransportProvider.overrideWithValue(transfer),
  ],child:const MaterialApp(home:InternalCryptoTransferScreen(
    ownerId:'user_test',providerCode:'USDTTRC20'))));
  await tester.pumpAndSettle();
}
void main(){
  testWidgets('review is mandatory: quote alone never commits crypto', (tester)async{
    final journal=_JournalStub(), transfer=_TransferStub();
    await mount(tester,journal,transfer);
    await tester.enterText(find.byType(TextField).at(0),'friend@example.com');
    await tester.enterText(find.byType(TextField).at(1),'2');
    await tester.tap(find.text('Get secure transfer quote'));
    await tester.pumpAndSettle();
    expect(transfer.quoteCount,1);
    expect(transfer.confirmCount,0);
    expect(find.text('Confirm this exact crypto transfer'),findsOneWidget);
    await tester.tap(find.text('Confirm this exact crypto transfer'));
    await tester.pumpAndSettle();
    expect(transfer.confirmCount,1);
    expect(find.text('Transfer completed and recorded on both accounts.'),findsOneWidget);
    expect(journal.saved,isNull);
  });
  testWidgets('restart resumes status only and never resends lost consent', (tester)async{
    final journal=_JournalStub()..saved='request_0199f499-8c22-7a12-9a18-07a317745bbb';
    final transfer=_TransferStub()
      ..current=_TransferStub().receipt('request_0199f499-8c22-7a12-9a18-07a317745bbb',token:false);
    await mount(tester,journal,transfer);
    expect(transfer.quoteCount,0);
    expect(transfer.confirmCount,0);
    expect(find.text('Confirm this exact crypto transfer'),findsNothing);
    expect(find.text('Check server status'),findsOneWidget);
  });
}
