import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/operations/operations_api.dart';
import 'package:masanawa_admin/src/features/operations/staff_page.dart';

class StaffFakeApi extends OperationsApi {
 StaffFakeApi(this.deny):super(Dio(),accessToken:() async=>'unused');
 bool deny;
 @override Future<List<StaffMember>> staff() async {
  if(deny)throw Exception('403');
  return [const StaffMember(userId:'staff_123',roles:['ops_admin'],mfaVerified:true)];
 }
 @override Future<List<AuditEvent>> audit() async {
  if(deny)throw Exception('403');
  return [const AuditEvent(action:'admin_ops.flag_change',actorId:'staff_123',
   at:'2026-10-10T00:00:00Z',subject:'posting')];
 }
}
void main(){
 testWidgets('A19 staff roles and audit show exact server data', (tester) async {
  await tester.pumpWidget(MaterialApp(home:StaffPage(api:StaffFakeApi(false))));
  await tester.pumpAndSettle();
  expect(find.text('staff_123'),findsOneWidget);
  await tester.tap(find.text('Audit'));await tester.pumpAndSettle();
  expect(find.text('admin_ops.flag_change'),findsOneWidget);
 });
 testWidgets('A19 denies unauthorized access without a local fallback', (tester) async {
  await tester.pumpWidget(MaterialApp(home:StaffPage(api:StaffFakeApi(true))));
  await tester.pumpAndSettle();
  expect(find.textContaining('unavailable or access denied'), findsOneWidget);
  // An unselected Audit tab must not leak a rejected Future into the test
  // zone (or crash the application before the user opens that tab).
  expect(tester.takeException(), isNull);
 });
 testWidgets('A19 never retains another admin account staff or audit', (tester) async {
  await tester.pumpWidget(MaterialApp(home:StaffPage(api:StaffFakeApi(false))));
  await tester.pumpAndSettle();
  expect(find.text('staff_123'), findsOneWidget);
  // Same State, but a new authenticated API client/account.
  await tester.pumpWidget(MaterialApp(home:StaffPage(api:StaffFakeApi(true))));
  await tester.pumpAndSettle();
  expect(find.text('staff_123'), findsNothing);
  expect(find.text('Staff directory unavailable or access denied.'), findsOneWidget);
  await tester.tap(find.text('Audit'));
  await tester.pumpAndSettle();
  expect(find.text('admin_ops.flag_change'), findsNothing);
  expect(find.text('Audit history unavailable or access denied.'), findsOneWidget);
  expect(tester.takeException(), isNull);
 });
 testWidgets('A19 audit 403 is rendered when selecting its lazy tab', (tester) async {
  await tester.pumpWidget(MaterialApp(home:StaffPage(api:StaffFakeApi(true))));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Audit'));
  await tester.pumpAndSettle();
  expect(find.text('Audit history unavailable or access denied.'), findsOneWidget);
  expect(tester.takeException(), isNull);
 });
 testWidgets('A19 retry recovers only from a fresh server read', (tester) async {
  final api = StaffFakeApi(true);
  await tester.pumpWidget(MaterialApp(home:StaffPage(api:api)));
  await tester.pumpAndSettle();
  expect(find.text('staff_123'), findsNothing);
  api.deny = false;
  await tester.tap(find.text('Retry'));
  await tester.pumpAndSettle();
  expect(find.text('staff_123'), findsOneWidget);
  await tester.tap(find.text('Audit'));
  await tester.pumpAndSettle();
  expect(find.text('admin_ops.flag_change'), findsOneWidget);
  expect(tester.takeException(), isNull);
 });
}
