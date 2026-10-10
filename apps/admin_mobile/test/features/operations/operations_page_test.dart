import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/operations/operations_api.dart';
import 'package:masanawa_admin/src/features/operations/operations_page.dart';

class FakeApi extends OperationsApi {
  FakeApi(this.fail):super(Dio(),accessToken:() async=>'never-network');
  final bool fail;
  @override
  Future<List<OperationFlag>> flags() async {
    if(fail)throw DioException(requestOptions:RequestOptions(path:'/' ),type:DioExceptionType.connectionError);
    return [const OperationFlag(name:'posting',enabled:false,revision:0,updatedAt:null)];
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
}
