import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/operator_scheduling/reminder_models.dart';
import 'package:masanawa/src/operator_scheduling/reminders_screen.dart';

void main() {
  testWidgets('requires affirmative consent before submit', (tester) async {
    final captured=<Map<String,dynamic>>[];
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:ReminderEditor(
      target:const ReminderTarget(ReminderKind.talkReminder,'talk_12345'),
      busy:()=>false,onSubmit:(data) async=>captured.add(data),
    ))));
    final button=find.widgetWithText(FilledButton,'Save reminder');
    expect(tester.widget<FilledButton>(button).onPressed,isNull);
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    expect(tester.widget<FilledButton>(button).onPressed,isNotNull);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(captured,hasLength(1));
    expect(captured.single['optedIn'],true);
    expect(captured.single['kind'],'talk_reminder');
    expect(captured.single.containsKey('amount'),false);
  });
}
