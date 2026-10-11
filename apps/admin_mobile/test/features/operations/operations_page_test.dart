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
  Future<OperationsOverview> overview() async {
    if(fail)throw Exception('Metrics unavailable');
    return const OperationsOverview(
      pendingJobs:3,activeJobLeases:1,deadLetters:2,
      openFinancialReconciliation:0);
  }
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
  expect(find.text('Queues and safety'), findsOneWidget);
  expect(find.text('Pending jobs'), findsOneWidget);
  expect(find.text('3'), findsOneWidget);
  expect(find.text('Dead letters'), findsOneWidget);
 });
 testWidgets('A18 offline never reports operational success', (tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsPage(api:FakeApi(true))));
  await tester.pumpAndSettle();
  expect(find.textContaining('unavailable'), findsOneWidget);
  expect(find.text('Retry'), findsOneWidget);
  expect(find.text('3'),findsNothing);
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
