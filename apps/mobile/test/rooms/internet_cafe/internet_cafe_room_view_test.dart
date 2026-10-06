import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_models.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_room_view.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  testWidgets('loads through overridden transport and dispatches quick start',
      (tester) async {
    final transport = _ViewTransport();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          internetCafeTransportProvider.overrideWithValue(transport),
        ],
        child: MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          home: const InternetCafeRoomView(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(transport.loadCalls, 1);
    expect(find.text('Internet Cafe'), findsWidgets);
    expect(find.text('Data'), findsOneWidget);

    await tester.tap(find.text('Data'));
    await tester.pumpAndSettle();

    expect(transport.quickStartCalls, 1);
  });
}

class _ViewTransport implements InternetCafeTransport {
  int loadCalls = 0;
  int quickStartCalls = 0;

  final projection = InternetCafeRoomProjection(
    roomId: 'internet-cafe',
    title: 'Internet Cafe',
    subtitle: 'Everyday digital services.',
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
        services: [
          InternetCafeServiceOption(
            serviceId: 'data',
            label: 'Data bundles',
            description: 'Choose an eligible bundle.',
            family: InternetCafeServiceFamily.quickPurchase,
            intentId: 'billing.data.start',
            execution: InternetCafeExecutionBinding.billing(
              billingServiceRef: 'billing:data',
            ),
          ),
        ],
      ),
    ],
  );

  @override
  Future<InternetCafeRoomProjection> loadRoom() async {
    loadCalls++;
    return projection;
  }

  @override
  Future<InternetCafeRoomProjection> runQuickStart(
    InternetCafeQuickStart quickStart,
  ) async {
    quickStartCalls++;
    return projection;
  }

  @override
  Future<InternetCafeRoomProjection> selectService(
    InternetCafeServiceOption service,
  ) async =>
      projection;

  @override
  Future<InternetCafeRoomProjection> chooseSelectionOption({
    required InternetCafeSelectionProjection selection,
    required InternetCafeChoice option,
  }) async =>
      projection;

  @override
  Future<InternetCafeRoomProjection> submitIntake(
    InternetCafeIntakeSubmission submission,
  ) async =>
      projection;

  @override
  Future<InternetCafeRoomProjection> continueLastTask() async => projection;
}
