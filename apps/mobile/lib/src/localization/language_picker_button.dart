import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'locale_preference_scope.dart';
import 'masanawa_localization.dart';

/// Autonyms stay in their original scripts so a person can find their own
/// language even when the current UI locale is unfamiliar.
const _languageAutonyms = <String, String>{
  'en': 'English',
  'ha': 'Hausa',
  'ar': 'العربية',
  'fr': 'Français',
  'es': 'Español',
  'pt': 'Português',
};

/// Entry point shared by onboarding and (once coordinated) account Settings.
/// It never changes the speech language, account region, or payment currency.
class LanguagePickerButton extends StatefulWidget {
  const LanguagePickerButton({super.key});

  @override
  State<LanguagePickerButton> createState() => _LanguagePickerButtonState();
}

class _LanguagePickerButtonState extends State<LanguagePickerButton> {
  bool _saving = false;
  static const _deviceChoice = 'device';

  Future<void> _chooseLanguage() async {
    if (_saving) return;
    final controller = LocalePreferenceScope.of(context);
    final strings = AppLocalizations.of(context);
    final currentCode =
        controller.localeOverride?.languageCode ?? _deviceChoice;

    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                strings.languageDialogTitle,
                style: Theme.of(sheetContext).textTheme.titleLarge,
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: 12),
              ListTile(
                key: const Key('language-device'),
                leading: const Icon(Icons.settings_suggest_outlined),
                title: Text(strings.languageSystem),
                trailing: currentCode == _deviceChoice
                    ? Icon(Icons.check, semanticLabel: strings.languageSelected)
                    : null,
                onTap: () => Navigator.of(sheetContext).pop(_deviceChoice),
              ),
              const Divider(),
              for (final locale in MasanawaLocalization.supportedLocales)
                ListTile(
                  key: Key('language-${locale.languageCode}'),
                  title: Text(
                    _languageAutonyms[locale.languageCode] ??
                        locale.languageCode,
                  ),
                  trailing: currentCode == locale.languageCode
                      ? Icon(
                          Icons.check,
                          semanticLabel: strings.languageSelected,
                        )
                      : null,
                  onTap: () =>
                      Navigator.of(sheetContext).pop(locale.languageCode),
                ),
              const SizedBox(height: 12),
              Text(
                strings.languagePreviewNotice,
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );

    if (!mounted || picked == null || picked == currentCode) return;
    setState(() => _saving = true);
    try {
      await controller.select(picked == _deviceChoice ? null : Locale(picked));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).languageSaveFailed),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return TextButton.icon(
      key: const Key('language-picker'),
      onPressed: _saving ? null : _chooseLanguage,
      icon: _saving
          ? const SizedBox(
              height: 16,
              width: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.language, size: 20),
      label: Text(strings.languageAction),
    );
  }
}
