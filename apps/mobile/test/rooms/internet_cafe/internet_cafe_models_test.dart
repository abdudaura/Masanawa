import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_models.dart';

void main() {
  Map<String, dynamic> projectionJson() => {
        'roomId': 'internet-cafe',
        'title': 'Internet Cafe',
        'subtitle': 'Everyday digital services in one place.',
        'quickStarts': [
          {
            'intentId': 'billing.data.start',
            'label': 'Data',
            'serviceId': 'data',
            'iconKey': 'data',
          },
        ],
        'sections': [
          {
            'family': 'quick-purchase',
            'title': 'Quick Purchase',
            'description': 'Buy common services.',
            'services': [
              {
                'serviceId': 'data',
                'label': 'Data bundles',
                'description': 'Choose an eligible network and bundle.',
                'family': 'quick-purchase',
                'intentId': 'billing.data.start',
                'execution': {
                  'kind': 'billing',
                  'billingServiceRef': 'billing:data',
                },
                'iconKey': 'data',
              },
            ],
          },
          {
            'family': 'applications',
            'title': 'Applications',
            'description': 'Get help completing applications.',
            'services': [
              {
                'serviceId': 'job-application',
                'label': 'Job application',
                'description': 'Prepare the information needed to apply.',
                'family': 'applications',
                'intentId': 'skill.job-application.start',
                'execution': {
                  'kind': 'skill',
                  'skillRef': 'skill:job-application',
                },
                'intake': {
                  'title': 'Job application details',
                  'submitLabel': 'Continue',
                  'fields': [
                    {
                      'fieldId': 'role',
                      'label': 'Role',
                      'kind': 'short-text',
                      'required': true,
                    },
                    {
                      'fieldId': 'stage',
                      'label': 'What do you need?',
                      'kind': 'choice',
                      'required': true,
                      'choices': [
                        {'value': 'start', 'label': 'Start an application'},
                        {'value': 'review', 'label': 'Review my application'},
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
        'activeSelection': {
          'selectionId': 'network',
          'serviceId': 'data',
          'title': 'Choose network',
          'options': [
            {'value': 'network-a', 'label': 'Network A'},
            {'value': 'network-b', 'label': 'Network B'},
          ],
        },
        'continuationLabel': 'Continue your last Internet Cafe task',
      };

  test('parses billing and Skill mappings without provider truth', () {
    final projection = InternetCafeRoomProjection.fromJson(projectionJson());

    expect(projection.roomId, 'internet-cafe');
    expect(projection.quickStarts.single.serviceId, 'data');

    final data = projection.serviceById('data')!;
    expect(data.execution.kind, InternetCafeExecutionKind.billing);
    expect(data.execution.billingServiceRef, 'billing:data');
    expect(data.execution.skillRef, isNull);

    final application = projection.serviceById('job-application')!;
    expect(application.execution.kind, InternetCafeExecutionKind.skill);
    expect(application.execution.skillRef, 'skill:job-application');
    expect(application.intake?.fields.length, 2);

    expect(projection.activeSelection?.options.length, 2);
  });

  test('rejects mixed billing and Skill authority bindings', () {
    expect(
      () => InternetCafeExecutionBinding.fromJson({
        'kind': 'billing',
        'billingServiceRef': 'billing:data',
        'skillRef': 'skill:data',
      }),
      throwsFormatException,
    );

    expect(
      () => InternetCafeExecutionBinding.fromJson({
        'kind': 'skill',
        'skillRef': 'skill:document',
        'billingServiceRef': 'billing:document',
      }),
      throwsFormatException,
    );
  });

  test('rejects quick start that references unknown service', () {
    final json = projectionJson();
    json['quickStarts'] = [
      {
        'intentId': 'missing.start',
        'label': 'Missing',
        'serviceId': 'missing',
      },
    ];

    expect(
      () => InternetCafeRoomProjection.fromJson(json),
      throwsFormatException,
    );
  });

  test('rejects service placed in the wrong taxonomy section', () {
    final json = projectionJson();
    final sections = (json['sections'] as List).cast<Map<String, dynamic>>();
    final first = Map<String, dynamic>.from(sections.first);
    final services = (first['services'] as List)
        .cast<Map<String, dynamic>>()
        .map(Map<String, dynamic>.from)
        .toList();
    services.first['family'] = 'documents';
    first['services'] = services;
    json['sections'] = [first, sections[1]];

    expect(
      () => InternetCafeRoomProjection.fromJson(json),
      throwsFormatException,
    );
  });

  test('validates intake fields and emits only presentation values', () {
    final projection = InternetCafeRoomProjection.fromJson(projectionJson());
    final service = projection.serviceById('job-application')!;

    final submission = InternetCafeIntakeSubmission.validated(
      service: service,
      values: const {
        'role': 'Designer',
        'stage': 'review',
      },
    );

    expect(submission.serviceId, 'job-application');
    expect(submission.intentId, 'skill.job-application.start');
    expect(submission.values['role'], 'Designer');

    expect(
      () => InternetCafeIntakeSubmission.validated(
        service: service,
        values: const {'role': '', 'stage': 'review'},
      ),
      throwsFormatException,
    );

    expect(
      () => InternetCafeIntakeSubmission.validated(
        service: service,
        values: const {'role': 'Designer', 'stage': 'not-allowed'},
      ),
      throwsFormatException,
    );

    expect(
      () => InternetCafeIntakeSubmission.validated(
        service: service,
        values: const {
          'role': 'Designer',
          'stage': 'review',
          'price': '100',
        },
      ),
      throwsFormatException,
    );
  });

  test('requires server-projected selection options', () {
    expect(
      () => InternetCafeSelectionProjection.fromJson({
        'selectionId': 'bundle',
        'serviceId': 'data',
        'title': 'Choose bundle',
        'options': [],
      }),
      throwsFormatException,
    );
  });
}
