import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:admin_mobile/src/features/missions/missions_admin_client.dart';
import 'package:admin_mobile/src/features/missions/missions_admin_screen.dart';
class _Fake implements MissionsAdminClient {
  @override Future<List<MissionView>> missions()async=>[];
  @override Future<MissionView> create({required String characterId,required String weekStart,
    required String objective,required String topicFocus,required String budgetMinor})=>throw UnimplementedError();
  @override Future<MissionView> state(MissionView mission,String state)=>throw UnimplementedError();
  @override Future<List<MissionSlotView>> slots(String id)async=>[];
  @override Future<MissionSlotView> addSlot(String id,{required String atUtc,required String body,
    required String topic,required String costMinor})=>throw UnimplementedError();
  @override Future<MissionSlotView> approve(MissionSlotView slot)=>throw UnimplementedError();
  @override Future<MissionSlotView> retry(MissionSlotView slot)=>throw UnimplementedError();
  @override Future<MissionScorecard> scorecard(String id)=>throw UnimplementedError();
}
void main(){
  testWidgets('A07 empty state and create affordance',(tester)async{
    await tester.pumpWidget(MaterialApp(home:MissionsAdminScreen(client:_Fake())));
    await tester.pumpAndSettle();
    expect(find.textContaining('No weekly missions'),findsOneWidget);
    expect(find.text('New mission'),findsOneWidget);
  });
}
