import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/operations/operations_api.dart';
import 'package:masanawa_admin/src/features/operations/operations_page.dart';

class FakeApi extends OperationsApi {
  FakeApi(this.fail,{this.flagName='posting'}):super(Dio(),accessToken:() async=>'never-network');
  final bool fail;
  final String flagName;
  @override
  Future<List<OperationFlag>> flags() async {
    if(fail)throw DioException(requestOptions:RequestOptions(path:'/' ),type:DioExceptionType.connectionError);
    return [OperationFlag(name:flagName,enabled:false,revision:0,updatedAt:null)];
  }
}
void main(){
 testWidgets('A18 disabled state is honest', (tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(false))));
  await tester.pumpAndSettle();
  expect(find.text('Disabled'), findsOneWidget);
  expect(find.text('Production controls'), findsOneWidget);
 });
 testWidgets('A18 offline never reports operational success', (tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(true))));
  await tester.pumpAndSettle();
  expect(find.textContaining('unavailable'), findsOneWidget);
  expect(find.text('Retry'), findsOneWidget);
 });
 testWidgets('A18 account switch removes earlier operator flags and denies offline stale readback', (tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(false))));
  await tester.pumpAndSettle();
  expect(find.text('posting'),findsOneWidget);
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(true))));
  await tester.pumpAndSettle();
  expect(find.text('posting'),findsNothing);
  expect(find.textContaining('Operational state unavailable'),findsOneWidget);
  expect(tester.takeException(),isNull);
 });
 testWidgets('A18 replaces previous operator flag names with new authenticated values', (tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(false))));
  await tester.pumpAndSettle();
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(false,flagName:'calls'))));
  await tester.pumpAndSettle();
  expect(find.text('posting'),findsNothing);
  expect(find.text('calls'),findsOneWidget);
 });

}
