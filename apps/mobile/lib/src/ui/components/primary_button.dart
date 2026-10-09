import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';

/// Tier-1 primary action button — theme driven, ≥48dp touch target at normal
/// text size and vertically expandable for accessibility text scaling.
///
/// A busy action is not tappable, and assistive technology receives only one
/// accurate button node instead of duplicate label/spinner/button descendants.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
    this.expand = true,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;
  final bool expand;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final canPress = enabled && !loading && onPressed != null;
    final foreground = canPress
        ? Theme.of(context).colorScheme.onPrimary
        : u.textPrimary;
    final reducedMotion = MediaQuery.disableAnimationsOf(context);

    final button = Semantics(
      button: true,
      enabled: canPress,
      label: loading ? '$label, in progress' : label,
      liveRegion: loading,
      onTap: canPress ? onPressed : null,
      // InkWell still handles keyboard/pointer focus; screen readers get one
      // semantic action, not a nested second button or unlabeled indicator.
      excludeSemantics: true,
      child: Material(
        color: canPress ? u.brand : u.surfaceMuted,
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
        child: InkWell(
          onTap: canPress ? onPressed : null,
          excludeFromSemantics: true,
          borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: MasanawaTokens.touchTargetMin + 4,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (loading && reducedMotion)
                    Icon(Icons.hourglass_empty, size: 20, color: foreground)
                  else if (loading)
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(foreground),
                      ),
                    )
                  else if (icon != null)
                    Icon(icon, size: 20, color: foreground),
                  if (loading || icon != null) const SizedBox(width: 8),
                  Flexible(
                    fit: FlexFit.loose,
                    child: Text(
                      label,
                      textAlign: TextAlign.center,
                      softWrap: true,
                      style: TextStyle(
                        color: foreground,
                        fontSize: MasanawaTokens.fontSize['md'],
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

