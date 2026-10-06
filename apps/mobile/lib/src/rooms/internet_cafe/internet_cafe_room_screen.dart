import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import 'internet_cafe_models.dart';

class InternetCafeRoomScreen extends StatelessWidget {
  const InternetCafeRoomScreen({
    super.key,
    required this.projection,
    required this.loading,
    this.errorMessage,
    this.onRetry,
    this.onQuickStart,
    this.onServiceSelected,
    this.onSelectionOptionSelected,
    this.onSubmitIntake,
    this.onContinue,
  });

  final InternetCafeRoomProjection? projection;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final ValueChanged<InternetCafeQuickStart>? onQuickStart;
  final ValueChanged<InternetCafeServiceOption>? onServiceSelected;
  final void Function(
    InternetCafeSelectionProjection selection,
    InternetCafeChoice option,
  )? onSelectionOptionSelected;
  final ValueChanged<InternetCafeIntakeSubmission>? onSubmitIntake;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final view = projection;

    return Scaffold(
      backgroundColor: colors.surfaceBg,
      appBar: AppBar(title: const Text('Internet Cafe')),
      body: RefreshIndicator(
        onRefresh: () async => onRetry?.call(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (loading && view == null)
              const SizedBox(
                height: 420,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (errorMessage != null && view == null)
              _ErrorState(message: errorMessage!, onRetry: onRetry)
            else if (view == null)
              const _EmptyState()
            else ...[
              _RoomHeader(view: view),
              if (view.continuationLabel != null && onContinue != null) ...[
                const SizedBox(height: 12),
                _ContinueCard(
                  label: view.continuationLabel!,
                  onTap: onContinue!,
                ),
              ],
              if (view.quickStarts.isNotEmpty) ...[
                const SizedBox(height: 20),
                const _SectionTitle('Quick services'),
                const SizedBox(height: 10),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 560 ? 4 : 2;
                    final spacing = 10.0;
                    final width =
                        (constraints.maxWidth - spacing * (columns - 1)) / columns;
                    return Wrap(
                      spacing: spacing,
                      runSpacing: spacing,
                      children: [
                        for (final quickStart in view.quickStarts)
                          SizedBox(
                            width: width,
                            child: _QuickStartCard(
                              quickStart: quickStart,
                              onTap: onQuickStart == null
                                  ? null
                                  : () => onQuickStart!(quickStart),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ],
              if (view.activeSelection != null) ...[
                const SizedBox(height: 22),
                _SelectionCard(
                  selection: view.activeSelection!,
                  onSelected: onSelectionOptionSelected,
                ),
              ],
              const SizedBox(height: 22),
              for (final section in view.sections) ...[
                _ServiceSection(
                  section: section,
                  onSelected: onServiceSelected,
                  onSubmitIntake: onSubmitIntake,
                ),
                const SizedBox(height: 18),
              ],
              if (errorMessage != null)
                _InlineWarning(message: errorMessage!, onRetry: onRetry),
            ],
          ],
        ),
      ),
    );
  }
}

class _RoomHeader extends StatelessWidget {
  const _RoomHeader({required this.view});

  final InternetCafeRoomProjection view;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: colors.brand.withValues(alpha: .10),
            child: Icon(Icons.language_outlined, color: colors.brand),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  view.title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  view.subtitle,
                  style: TextStyle(
                    color: colors.textMuted,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContinueCard extends StatelessWidget {
  const _ContinueCard({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Material(
      color: colors.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.structuralBorder),
          ),
          child: Row(
            children: [
              Icon(Icons.history_outlined, color: colors.brand),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(Icons.chevron_right, color: colors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickStartCard extends StatelessWidget {
  const _QuickStartCard({required this.quickStart, required this.onTap});

  final InternetCafeQuickStart quickStart;
  final VoidCallback? onTap;

  IconData get _icon {
    switch (quickStart.iconKey) {
      case 'data':
        return Icons.signal_cellular_alt_outlined;
      case 'airtime':
        return Icons.phone_android_outlined;
      case 'electricity':
        return Icons.bolt_outlined;
      case 'tv':
        return Icons.tv_outlined;
      default:
        return Icons.flash_on_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Material(
      color: colors.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 96),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.structuralBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(_icon, size: 22, color: colors.brand),
              const SizedBox(height: 16),
              Text(
                quickStart.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectionCard extends StatelessWidget {
  const _SelectionCard({
    required this.selection,
    required this.onSelected,
  });

  final InternetCafeSelectionProjection selection;
  final void Function(
    InternetCafeSelectionProjection selection,
    InternetCafeChoice option,
  )? onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            selection.title,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (selection.subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              selection.subtitle!,
              style: TextStyle(color: colors.textMuted, fontSize: 12),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in selection.options)
                ActionChip(
                  label: Text(option.label),
                  onPressed: onSelected == null
                      ? null
                      : () => onSelected!(selection, option),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ServiceSection extends StatelessWidget {
  const _ServiceSection({
    required this.section,
    required this.onSelected,
    required this.onSubmitIntake,
  });

  final InternetCafeServiceSection section;
  final ValueChanged<InternetCafeServiceOption>? onSelected;
  final ValueChanged<InternetCafeIntakeSubmission>? onSubmitIntake;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          section.title,
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (section.description.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            section.description,
            style: TextStyle(color: colors.textMuted, fontSize: 12),
          ),
        ],
        const SizedBox(height: 9),
        for (final service in section.services)
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: _ServiceCard(
              service: service,
              onSelected: onSelected,
              onSubmitIntake: onSubmitIntake,
            ),
          ),
      ],
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({
    required this.service,
    required this.onSelected,
    required this.onSubmitIntake,
  });

  final InternetCafeServiceOption service;
  final ValueChanged<InternetCafeServiceOption>? onSelected;
  final ValueChanged<InternetCafeIntakeSubmission>? onSubmitIntake;

  IconData get _icon {
    switch (service.family) {
      case InternetCafeServiceFamily.quickPurchase:
        return Icons.shopping_bag_outlined;
      case InternetCafeServiceFamily.applications:
        return Icons.assignment_outlined;
      case InternetCafeServiceFamily.businessServices:
        return Icons.business_center_outlined;
      case InternetCafeServiceFamily.documents:
        return Icons.description_outlined;
      case InternetCafeServiceFamily.onlineHelp:
        return Icons.public_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Material(
      color: colors.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onSelected == null ? null : () => onSelected!(service),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.structuralBorder),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: colors.brand.withValues(alpha: .08),
                child: Icon(_icon, size: 20, color: colors.brand),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            service.label,
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (service.badge != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: colors.brand.withValues(alpha: .08),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              service.badge!,
                              style: TextStyle(
                                color: colors.brand,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      service.description,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                    if (service.intake != null && onSubmitIntake != null) ...[
                      const SizedBox(height: 9),
                      TextButton.icon(
                        onPressed: () => _showIntakeSheet(
                          context,
                          service,
                          onSubmitIntake!,
                        ),
                        icon: const Icon(Icons.edit_note_outlined, size: 18),
                        label: Text(service.intake!.submitLabel),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: colors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _showIntakeSheet(
  BuildContext context,
  InternetCafeServiceOption service,
  ValueChanged<InternetCafeIntakeSubmission> onSubmit,
) async {
  final intake = service.intake;
  if (intake == null) return;

  final values = <String, Object?>{};
  final controllers = <String, TextEditingController>{};
  for (final field in intake.fields) {
    if (field.kind != InternetCafeFieldKind.choice) {
      controllers[field.fieldId] = TextEditingController();
    }
  }

  try {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              18,
              16,
              18 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    intake.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (intake.intro != null) ...[
                    const SizedBox(height: 6),
                    Text(intake.intro!),
                  ],
                  const SizedBox(height: 16),
                  for (final field in intake.fields) ...[
                    if (field.kind == InternetCafeFieldKind.choice)
                      DropdownButtonFormField<String>(
                        value: values[field.fieldId] as String?,
                        decoration: InputDecoration(
                          labelText: field.label,
                          helperText: field.helpText,
                        ),
                        items: [
                          for (final choice in field.choices)
                            DropdownMenuItem(
                              value: choice.value,
                              child: Text(choice.label),
                            ),
                        ],
                        onChanged: (value) =>
                            setState(() => values[field.fieldId] = value),
                      )
                    else
                      TextField(
                        controller: controllers[field.fieldId],
                        minLines:
                            field.kind == InternetCafeFieldKind.longText ? 3 : 1,
                        maxLines:
                            field.kind == InternetCafeFieldKind.longText ? 6 : 1,
                        keyboardType: _keyboardTypeFor(field.kind),
                        decoration: InputDecoration(
                          labelText: field.label,
                          helperText: field.helpText,
                        ),
                      ),
                    const SizedBox(height: 12),
                  ],
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        for (final entry in controllers.entries) {
                          values[entry.key] = entry.value.text;
                        }
                        try {
                          final submission =
                              InternetCafeIntakeSubmission.validated(
                            service: service,
                            values: values,
                          );
                          onSubmit(submission);
                          Navigator.of(context).pop();
                        } on FormatException catch (error) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(error.message.toString())),
                          );
                        }
                      },
                      child: Text(intake.submitLabel),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  } finally {
    for (final controller in controllers.values) {
      controller.dispose();
    }
  }
}

TextInputType _keyboardTypeFor(InternetCafeFieldKind kind) {
  switch (kind) {
    case InternetCafeFieldKind.phone:
      return TextInputType.phone;
    case InternetCafeFieldKind.email:
      return TextInputType.emailAddress;
    case InternetCafeFieldKind.date:
      return TextInputType.datetime;
    case InternetCafeFieldKind.shortText:
    case InternetCafeFieldKind.longText:
    case InternetCafeFieldKind.choice:
    case InternetCafeFieldKind.document:
      return TextInputType.text;
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Text(
      text,
      style: TextStyle(
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 420,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, size: 36, color: colors.textMuted),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textMuted),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}

class _InlineWarning extends StatelessWidget {
  const _InlineWarning({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Row(
      children: [
        Icon(Icons.info_outline, size: 18, color: colors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: TextStyle(color: colors.textMuted, fontSize: 12),
          ),
        ),
        if (onRetry != null)
          TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 420,
      child: Center(
        child: Text(
          'Internet Cafe is not available yet.',
          style: TextStyle(color: colors.textMuted),
        ),
      ),
    );
  }
}
