import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_models.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_room_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  InternetCafeRoomProjection projection() {
    final data = InternetCafeServiceOption(
      serviceId: 'data',
      label: 'Data bundles',
      description: 'Choose an eligible network and bundle.',
      family: InternetCafeServiceFamily.quickPurchase,
      intentId: 'billing.data.start',
      execution: InternetCafeExecutionBinding.billing(
        billingServiceRef: 'billing:data',
      ),
      iconKey: 'data',
    );

    final application = InternetCafeServiceOption(
      serviceId: 'job-application',
      label: 'Job application',
      description: 'Prepare the information needed to apply.',
      family: InternetCafeServiceFamily.applications,
      intentId: 'skill.job-application.start',
      execution: InternetCafeExecutionBinding.skill(
        skillRef: 'skill:job-application',
      ),
      intake: const InternetCafeTaskIntake(
        title: 'Job application details',
        submitLabel: 'Continue',
        fields: [
          InternetCafeIntakeField(
            fieldId: 'role',
            label: 'Role',
            kind: InternetCafeFieldKind.shortText,
            required: true,
          ),
          InternetCafeIntakeField(
            fieldId: 'stage',
            label: 'What do you need?',
            kind: InternetCafeFieldKind.choice,
            required: true,
            choices: [
              InternetCafeChoice(
                value: 'start',
                label: 'Start an application',
              ),
              InternetCafeChoice(
                value: 'review',
                label: 'Review my application',
              ),
            ],
          ),
        ],
      ),
    );

    return InternetCafeRoomProjection(
      roomId: 'internet-cafe',
      title: 'Internet Cafe',
      subtitle: 'Everyday digital services in one place.',
      quickStarts: const [
        InternetCafeQuickStart(
          intentId: 'billing.data.start',
          label: 'Data',
          serviceId: 'data',
          iconKey: 'data',
        ),
      ],
      sections: [
        InternetCafeServiceSection(
          family: InternetCafeServiceFamily.quickPurchase,
          title: 'Quick Purchase',
          description: 'Buy common services.',
          services: [data],
        ),
        InternetCafeServiceSection(
          family: InternetCafeServiceFamily.applications,
          title: 'Applications',
          description: 'Get help completing applications.',
          services: [application],
        ),
      ],
      activeSelection: const InternetCafeSelectionProjection(
        selectionId: 'network',
        serviceId: 'data',
        title: 'Choose network',
        options: [
          InternetCafeChoice(value: 'a', label: 'Network A'),
          InternetCafeChoice(value: 'b', label: 'Network B'),
        ],
      ),
      continuationLabel: 'Continue your last Internet Cafe task',
    );
  }

  Widget app(Widget child) => MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: child,
      );

  testWidgets('renders server projection and emits typed actions', (tester) async {
    InternetCafeQuickStart? quickStart;
    InternetCafeServiceOption? service;
    InternetCafeChoice? selection;

    await tester.pumpWidget(
      app(
        InternetCafeRoomScreen(
          projection: projection(),
          loading: false,
          onQuickStart: (value) => quickStart = value,
          onServiceSelected: (value) => service = value,
          onSelectionOptionSelected: (_, value) => selection = value,
        ),
      ),
    );

    expect(find.text('Internet Cafe'), findsWidgets);
    expect(find.text('Data'), findsOneWidget);
    expect(find.text('Data bundles'), findsOneWidget);
    expect(find.text('Applications'), findsOneWidget);
    expect(find.text('Choose network'), findsOneWidget);

    await tester.tap(find.text('Data'));
    await tester.pump();
    expect(quickStart?.intentId, 'billing.data.start');

    await tester.tap(find.text('Data bundles'));
    await tester.pump();
    expect(service?.execution.billingServiceRef, 'billing:data');

    await tester.tap(find.text('Network B'));
    await tester.pump();
    expect(selection?.value, 'b');
  });

  testWidgets('renders responsive loading and isolated error states', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      app(
        const InternetCafeRoomScreen(
          projection: null,
          loading: true,
        ),
      ),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    var retries = 0;
    await tester.pumpWidget(
      app(
        InternetCafeRoomScreen(
          projection: null,
          loading: false,
          errorMessage: 'Internet Cafe is unavailable.',
          onRetry: () => retries++,
        ),
      ),
    );
    expect(find.text('Internet Cafe is unavailable.'), findsOneWidget);

    await tester.tap(find.text('Try again'));
    await tester.pump();
    expect(retries, 1);
  });

  testWidgets('collects application intake and emits validated submission',
      (tester) async {
    InternetCafeIntakeSubmission? submission;

    await tester.pumpWidget(
      app(
        InternetCafeRoomScreen(
          projection: projection(),
          loading: false,
          onSubmitIntake: (value) => submission = value,
        ),
      ),
    );

    await tester.tap(find.text('Continue').first);
    await tester.pumpAndSettle();

    expect(find.text('Job application details'), findsOneWidget);

    await tester.enterText(
      find.byType(TextField).first,
      'Designer',
    );
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review my application').last);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Continue').last);
    await tester.pumpAndSettle();

    expect(submission?.serviceId, 'job-application');
    expect(submission?.values['role'], 'Designer');
    expect(submission?.values['stage'], 'review');
  });
}
