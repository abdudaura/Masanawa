import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/operations/operations_api.dart';
import 'package:masanawa_admin/src/features/operations/overview_page.dart';

class OverviewFakeApi extends OperationsApi {
 OverviewFakeApi(this.pending,{this.denied=false})
    : super(Dio(),accessToken:() async=>'unused');
 final int pending;
 final bool denied;
 @override
 Future<OperationsOverview> overview() async {
  if(denied) throw DioException(
    requestOptions:RequestOptions(path:'/v1/admin/ops/overview'),
    type:DioExceptionType.badResponse);
  return OperationsOverview(
    pendingJobs:pending,activeJobLeases:0,deadLetters:0,
    openFinancialReconciliation:0,
  );
 }
}
void main(){
 testWidgets('A01 real gateway counters appear and unknown signals stay unknown',(tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsOverviewPage(api:OverviewFakeApi(7))));
  await tester.pumpAndSettle();
  expect(find.text('7'),findsOneWidget);
  expect(find.text('Unknown'),findsWidgets);
 });
 testWidgets('A01 refuses to display previous tenant counts after switch to denied staff',(tester) async {
  await tester.pumpWidget(MaterialApp(home:OperationsOverviewPage(api:OverviewFakeApi(7))));
  await tester.pumpAndSettle();
  expect(find.text('7'),findsOneWidget);
  await tester.pumpWidget(MaterialApp(home:OperationsOverviewPage(api:OverviewFakeApi(0,denied:true))));
  await tester.pumpAndSettle();
  expect(find.text('7'),findsNothing);
  expect(find.textContaining('Metrics are unavailable'),findsOneWidget);
  expect(tester.takeException(),isNull);
 });
}
