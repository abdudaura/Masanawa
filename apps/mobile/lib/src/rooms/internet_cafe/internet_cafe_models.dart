enum InternetCafeServiceFamily {
  quickPurchase,
  applications,
  businessServices,
  documents,
  onlineHelp,
}

InternetCafeServiceFamily internetCafeServiceFamilyFromWire(String value) {
  switch (value) {
    case 'quick-purchase':
      return InternetCafeServiceFamily.quickPurchase;
    case 'applications':
      return InternetCafeServiceFamily.applications;
    case 'business-services':
      return InternetCafeServiceFamily.businessServices;
    case 'documents':
      return InternetCafeServiceFamily.documents;
    case 'online-help':
      return InternetCafeServiceFamily.onlineHelp;
    default:
      throw FormatException('Unknown Internet Cafe service family: $value');
  }
}

enum InternetCafeExecutionKind {
  billing,
  skill,
}

InternetCafeExecutionKind internetCafeExecutionKindFromWire(String value) {
  switch (value) {
    case 'billing':
      return InternetCafeExecutionKind.billing;
    case 'skill':
      return InternetCafeExecutionKind.skill;
    default:
      throw FormatException('Unknown Internet Cafe execution kind: $value');
  }
}

enum InternetCafeFieldKind {
  shortText,
  longText,
  choice,
  date,
  phone,
  email,
  document,
}

InternetCafeFieldKind internetCafeFieldKindFromWire(String value) {
  switch (value) {
    case 'short-text':
      return InternetCafeFieldKind.shortText;
    case 'long-text':
      return InternetCafeFieldKind.longText;
    case 'choice':
      return InternetCafeFieldKind.choice;
    case 'date':
      return InternetCafeFieldKind.date;
    case 'phone':
      return InternetCafeFieldKind.phone;
    case 'email':
      return InternetCafeFieldKind.email;
    case 'document':
      return InternetCafeFieldKind.document;
    default:
      throw FormatException('Unknown Internet Cafe intake field kind: $value');
  }
}

class InternetCafeExecutionBinding {
  const InternetCafeExecutionBinding._({
    required this.kind,
    this.billingServiceRef,
    this.skillRef,
  });

  factory InternetCafeExecutionBinding.billing({
    required String billingServiceRef,
  }) {
    if (billingServiceRef.trim().isEmpty) {
      throw const FormatException('Billing service reference is required');
    }
    return InternetCafeExecutionBinding._(
      kind: InternetCafeExecutionKind.billing,
      billingServiceRef: billingServiceRef,
    );
  }

  factory InternetCafeExecutionBinding.skill({required String skillRef}) {
    if (skillRef.trim().isEmpty) {
      throw const FormatException('Skill reference is required');
    }
    return InternetCafeExecutionBinding._(
      kind: InternetCafeExecutionKind.skill,
      skillRef: skillRef,
    );
  }

  final InternetCafeExecutionKind kind;

  /// Opaque server-owned reference resolved by canonical billing composition.
  final String? billingServiceRef;

  /// Opaque server-owned reference resolved by canonical Skill discovery/admission.
  final String? skillRef;

  factory InternetCafeExecutionBinding.fromJson(Map<String, dynamic> json) {
    final rawKind = json['kind'];
    if (rawKind is! String) {
      throw const FormatException('Internet Cafe execution kind is required');
    }

    final kind = internetCafeExecutionKindFromWire(rawKind);
    final billingServiceRef = json['billingServiceRef'];
    final skillRef = json['skillRef'];

    if ((billingServiceRef != null && billingServiceRef is! String) ||
        (skillRef != null && skillRef is! String)) {
      throw const FormatException('Invalid Internet Cafe execution binding');
    }

    switch (kind) {
      case InternetCafeExecutionKind.billing:
        if (billingServiceRef is! String ||
            billingServiceRef.trim().isEmpty ||
            skillRef != null) {
          throw const FormatException(
            'Billing binding requires only billingServiceRef',
          );
        }
        return InternetCafeExecutionBinding.billing(
          billingServiceRef: billingServiceRef,
        );
      case InternetCafeExecutionKind.skill:
        if (skillRef is! String || skillRef.trim().isEmpty || billingServiceRef != null) {
          throw const FormatException('Skill binding requires only skillRef');
        }
        return InternetCafeExecutionBinding.skill(skillRef: skillRef);
    }
  }
}

class InternetCafeChoice {
  const InternetCafeChoice({
    required this.value,
    required this.label,
    this.description,
  });

  final String value;
  final String label;
  final String? description;

  factory InternetCafeChoice.fromJson(Map<String, dynamic> json) {
    final value = json['value'];
    final label = json['label'];
    final description = json['description'];
    if (value is! String ||
        value.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        (description != null && description is! String)) {
      throw const FormatException('Invalid Internet Cafe choice');
    }
    return InternetCafeChoice(
      value: value,
      label: label,
      description: description as String?,
    );
  }
}

class InternetCafeIntakeField {
  const InternetCafeIntakeField({
    required this.fieldId,
    required this.label,
    required this.kind,
    required this.required,
    this.helpText,
    this.choices = const [],
  });

  final String fieldId;
  final String label;
  final InternetCafeFieldKind kind;
  final bool required;
  final String? helpText;
  final List<InternetCafeChoice> choices;

  factory InternetCafeIntakeField.fromJson(Map<String, dynamic> json) {
    final fieldId = json['fieldId'];
    final label = json['label'];
    final rawKind = json['kind'];
    final required = json['required'];
    final helpText = json['helpText'];
    final rawChoices = json['choices'] ?? const [];

    if (fieldId is! String ||
        fieldId.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        rawKind is! String ||
        required is! bool ||
        (helpText != null && helpText is! String) ||
        rawChoices is! List) {
      throw const FormatException('Invalid Internet Cafe intake field');
    }

    final kind = internetCafeFieldKindFromWire(rawKind);
    final choices = <InternetCafeChoice>[
      for (final item in rawChoices)
        if (item is Map)
          InternetCafeChoice.fromJson(item.cast<String, dynamic>()),
    ];

    if (choices.length != rawChoices.length) {
      throw const FormatException('Invalid Internet Cafe intake choice');
    }
    if (kind == InternetCafeFieldKind.choice && choices.isEmpty) {
      throw const FormatException('Choice field requires choices');
    }
    if (kind != InternetCafeFieldKind.choice && choices.isNotEmpty) {
      throw const FormatException('Only choice fields may define choices');
    }

    return InternetCafeIntakeField(
      fieldId: fieldId,
      label: label,
      kind: kind,
      required: required,
      helpText: helpText as String?,
      choices: List.unmodifiable(choices),
    );
  }
}

class InternetCafeTaskIntake {
  const InternetCafeTaskIntake({
    required this.title,
    required this.submitLabel,
    required this.fields,
    this.intro,
  });

  final String title;
  final String submitLabel;
  final String? intro;
  final List<InternetCafeIntakeField> fields;

  factory InternetCafeTaskIntake.fromJson(Map<String, dynamic> json) {
    final title = json['title'];
    final submitLabel = json['submitLabel'];
    final intro = json['intro'];
    final rawFields = json['fields'];

    if (title is! String ||
        title.trim().isEmpty ||
        submitLabel is! String ||
        submitLabel.trim().isEmpty ||
        (intro != null && intro is! String) ||
        rawFields is! List) {
      throw const FormatException('Invalid Internet Cafe task intake');
    }

    final fields = <InternetCafeIntakeField>[
      for (final item in rawFields)
        if (item is Map)
          InternetCafeIntakeField.fromJson(item.cast<String, dynamic>()),
    ];
    if (fields.length != rawFields.length) {
      throw const FormatException('Invalid Internet Cafe task intake fields');
    }

    final ids = fields.map((field) => field.fieldId).toSet();
    if (ids.length != fields.length) {
      throw const FormatException('Duplicate Internet Cafe intake field ID');
    }

    return InternetCafeTaskIntake(
      title: title,
      submitLabel: submitLabel,
      intro: intro as String?,
      fields: List.unmodifiable(fields),
    );
  }
}

class InternetCafeServiceOption {
  const InternetCafeServiceOption({
    required this.serviceId,
    required this.label,
    required this.description,
    required this.family,
    required this.intentId,
    required this.execution,
    this.iconKey,
    this.intake,
    this.badge,
  });

  final String serviceId;
  final String label;
  final String description;
  final InternetCafeServiceFamily family;

  /// Opaque server-owned continuation/quick-start intent.
  final String intentId;

  final InternetCafeExecutionBinding execution;
  final String? iconKey;
  final InternetCafeTaskIntake? intake;
  final String? badge;

  factory InternetCafeServiceOption.fromJson(Map<String, dynamic> json) {
    final serviceId = json['serviceId'];
    final label = json['label'];
    final description = json['description'];
    final rawFamily = json['family'];
    final intentId = json['intentId'];
    final rawExecution = json['execution'];
    final iconKey = json['iconKey'];
    final rawIntake = json['intake'];
    final badge = json['badge'];

    if (serviceId is! String ||
        serviceId.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        description is! String ||
        rawFamily is! String ||
        intentId is! String ||
        intentId.trim().isEmpty ||
        rawExecution is! Map ||
        (iconKey != null && iconKey is! String) ||
        (rawIntake != null && rawIntake is! Map) ||
        (badge != null && badge is! String)) {
      throw const FormatException('Invalid Internet Cafe service option');
    }

    return InternetCafeServiceOption(
      serviceId: serviceId,
      label: label,
      description: description,
      family: internetCafeServiceFamilyFromWire(rawFamily),
      intentId: intentId,
      execution: InternetCafeExecutionBinding.fromJson(
        rawExecution.cast<String, dynamic>(),
      ),
      iconKey: iconKey as String?,
      intake: rawIntake is Map
          ? InternetCafeTaskIntake.fromJson(rawIntake.cast<String, dynamic>())
          : null,
      badge: badge as String?,
    );
  }
}

class InternetCafeServiceSection {
  const InternetCafeServiceSection({
    required this.family,
    required this.title,
    required this.description,
    required this.services,
  });

  final InternetCafeServiceFamily family;
  final String title;
  final String description;
  final List<InternetCafeServiceOption> services;

  factory InternetCafeServiceSection.fromJson(Map<String, dynamic> json) {
    final rawFamily = json['family'];
    final title = json['title'];
    final description = json['description'];
    final rawServices = json['services'];

    if (rawFamily is! String ||
        title is! String ||
        title.trim().isEmpty ||
        description is! String ||
        rawServices is! List) {
      throw const FormatException('Invalid Internet Cafe service section');
    }

    final family = internetCafeServiceFamilyFromWire(rawFamily);
    final services = <InternetCafeServiceOption>[
      for (final item in rawServices)
        if (item is Map)
          InternetCafeServiceOption.fromJson(item.cast<String, dynamic>()),
    ];
    if (services.length != rawServices.length) {
      throw const FormatException('Invalid Internet Cafe service list');
    }
    if (services.any((service) => service.family != family)) {
      throw const FormatException(
        'Internet Cafe service family does not match its section',
      );
    }

    return InternetCafeServiceSection(
      family: family,
      title: title,
      description: description,
      services: List.unmodifiable(services),
    );
  }
}

class InternetCafeQuickStart {
  const InternetCafeQuickStart({
    required this.intentId,
    required this.label,
    required this.serviceId,
    this.iconKey,
  });

  final String intentId;
  final String label;
  final String serviceId;
  final String? iconKey;

  factory InternetCafeQuickStart.fromJson(Map<String, dynamic> json) {
    final intentId = json['intentId'];
    final label = json['label'];
    final serviceId = json['serviceId'];
    final iconKey = json['iconKey'];

    if (intentId is! String ||
        intentId.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        serviceId is! String ||
        serviceId.trim().isEmpty ||
        (iconKey != null && iconKey is! String)) {
      throw const FormatException('Invalid Internet Cafe quick start');
    }

    return InternetCafeQuickStart(
      intentId: intentId,
      label: label,
      serviceId: serviceId,
      iconKey: iconKey as String?,
    );
  }
}

class InternetCafeSelectionProjection {
  const InternetCafeSelectionProjection({
    required this.selectionId,
    required this.serviceId,
    required this.title,
    required this.options,
    this.subtitle,
  });

  final String selectionId;
  final String serviceId;
  final String title;
  final String? subtitle;
  final List<InternetCafeChoice> options;

  factory InternetCafeSelectionProjection.fromJson(Map<String, dynamic> json) {
    final selectionId = json['selectionId'];
    final serviceId = json['serviceId'];
    final title = json['title'];
    final subtitle = json['subtitle'];
    final rawOptions = json['options'];

    if (selectionId is! String ||
        selectionId.trim().isEmpty ||
        serviceId is! String ||
        serviceId.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        (subtitle != null && subtitle is! String) ||
        rawOptions is! List) {
      throw const FormatException('Invalid Internet Cafe selection projection');
    }

    final options = <InternetCafeChoice>[
      for (final item in rawOptions)
        if (item is Map)
          InternetCafeChoice.fromJson(item.cast<String, dynamic>()),
    ];
    if (options.length != rawOptions.length || options.isEmpty) {
      throw const FormatException('Internet Cafe selection requires options');
    }

    return InternetCafeSelectionProjection(
      selectionId: selectionId,
      serviceId: serviceId,
      title: title,
      subtitle: subtitle as String?,
      options: List.unmodifiable(options),
    );
  }
}

class InternetCafeRoomProjection {
  const InternetCafeRoomProjection({
    required this.roomId,
    required this.title,
    required this.subtitle,
    required this.quickStarts,
    required this.sections,
    this.activeSelection,
    this.continuationLabel,
  });

  final String roomId;
  final String title;
  final String subtitle;
  final List<InternetCafeQuickStart> quickStarts;
  final List<InternetCafeServiceSection> sections;
  final InternetCafeSelectionProjection? activeSelection;
  final String? continuationLabel;

  factory InternetCafeRoomProjection.fromJson(Map<String, dynamic> json) {
    final roomId = json['roomId'];
    final title = json['title'];
    final subtitle = json['subtitle'];
    final rawQuickStarts = json['quickStarts'];
    final rawSections = json['sections'];
    final rawActiveSelection = json['activeSelection'];
    final continuationLabel = json['continuationLabel'];

    if (roomId is! String ||
        roomId.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        subtitle is! String ||
        rawQuickStarts is! List ||
        rawSections is! List ||
        (rawActiveSelection != null && rawActiveSelection is! Map) ||
        (continuationLabel != null && continuationLabel is! String)) {
      throw const FormatException('Invalid Internet Cafe room projection');
    }

    final quickStarts = <InternetCafeQuickStart>[
      for (final item in rawQuickStarts)
        if (item is Map)
          InternetCafeQuickStart.fromJson(item.cast<String, dynamic>()),
    ];
    final sections = <InternetCafeServiceSection>[
      for (final item in rawSections)
        if (item is Map)
          InternetCafeServiceSection.fromJson(item.cast<String, dynamic>()),
    ];

    if (quickStarts.length != rawQuickStarts.length ||
        sections.length != rawSections.length) {
      throw const FormatException('Invalid Internet Cafe projected collections');
    }

    final allServices = [
      for (final section in sections) ...section.services,
    ];
    final serviceIds = allServices.map((service) => service.serviceId).toSet();
    if (serviceIds.length != allServices.length) {
      throw const FormatException('Duplicate Internet Cafe service ID');
    }
    if (quickStarts.any((quickStart) => !serviceIds.contains(quickStart.serviceId))) {
      throw const FormatException(
        'Internet Cafe quick start references unknown service',
      );
    }

    final activeSelection = rawActiveSelection is Map
        ? InternetCafeSelectionProjection.fromJson(
            rawActiveSelection.cast<String, dynamic>(),
          )
        : null;
    if (activeSelection != null &&
        !serviceIds.contains(activeSelection.serviceId)) {
      throw const FormatException(
        'Internet Cafe selection references unknown service',
      );
    }

    return InternetCafeRoomProjection(
      roomId: roomId,
      title: title,
      subtitle: subtitle,
      quickStarts: List.unmodifiable(quickStarts),
      sections: List.unmodifiable(sections),
      activeSelection: activeSelection,
      continuationLabel: continuationLabel as String?,
    );
  }

  InternetCafeServiceOption? serviceById(String serviceId) {
    for (final section in sections) {
      for (final service in section.services) {
        if (service.serviceId == serviceId) return service;
      }
    }
    return null;
  }
}

class InternetCafeIntakeSubmission {
  const InternetCafeIntakeSubmission({
    required this.serviceId,
    required this.intentId,
    required this.values,
  });

  final String serviceId;
  final String intentId;

  /// Values are user-entered presentation data only. Canonical runtime validation
  /// and execution remain server-owned.
  final Map<String, Object?> values;

  factory InternetCafeIntakeSubmission.validated({
    required InternetCafeServiceOption service,
    required Map<String, Object?> values,
  }) {
    final intake = service.intake;
    if (intake == null) {
      throw const FormatException('Selected service does not accept task intake');
    }

    final allowed = intake.fields.map((field) => field.fieldId).toSet();
    if (values.keys.any((key) => !allowed.contains(key))) {
      throw const FormatException('Unknown Internet Cafe intake field');
    }

    for (final field in intake.fields) {
      final value = values[field.fieldId];
      final missing = value == null || (value is String && value.trim().isEmpty);
      if (field.required && missing) {
        throw FormatException('Required intake field missing: ${field.fieldId}');
      }
      if (missing) continue;

      if (field.kind == InternetCafeFieldKind.choice) {
        if (value is! String ||
            !field.choices.any((choice) => choice.value == value)) {
          throw FormatException('Invalid choice for field: ${field.fieldId}');
        }
      } else if (value is! String) {
        throw FormatException('Invalid value for field: ${field.fieldId}');
      }
    }

    return InternetCafeIntakeSubmission(
      serviceId: service.serviceId,
      intentId: service.intentId,
      values: Map.unmodifiable(Map<String, Object?>.from(values)),
    );
  }
}
