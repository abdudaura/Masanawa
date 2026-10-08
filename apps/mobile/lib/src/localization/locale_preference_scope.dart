import 'package:flutter/widgets.dart';

import 'locale_preference.dart';

/// Exposes the one app-owned locale preference controller to nested routes.
///
/// The router is intentionally not recreated on language selection. Settings,
/// onboarding and future user-facing language controls share one saved choice.
class LocalePreferenceScope extends InheritedNotifier<LocalePreferenceController> {
  const LocalePreferenceScope({
    super.key,
    required LocalePreferenceController controller,
    required super.child,
  }) : super(notifier: controller);

  static LocalePreferenceController of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<LocalePreferenceScope>();
    final controller = scope?.notifier;
    if (controller == null) {
      throw StateError(
        'LocalePreferenceScope is required above the application router',
      );
    }
    return controller;
  }
}
