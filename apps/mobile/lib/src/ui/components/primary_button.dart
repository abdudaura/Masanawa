import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';

/// Tier-1 primary action button — brand filled, full-width by default,
/// ≥44dp touch target, token-driven motion.
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
    final labelWidget = Text(
      label,
      textAlign: TextAlign.center,
      softWrap: true,
      style: TextStyle(
        color: canPress ? Colors.white : u.textMuted,
        fontSize: MasanawaTokens.fontSize['md'],
        fontWeight: FontWeight.w600,
      ),
    );
    final button = Material(
      color: canPress ? u.brand : u.surfaceMuted,
      borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
      child: InkWell(
        onTap: canPress ? onPressed : null,
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: MasanawaTokens.touchTargetMin + 4,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Row(
              mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (loading)
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        canPress ? Colors.white : u.textMuted,
                      ),
                    ),
                  )
                else if (icon != null)
                  Icon(icon, size: 20, color: canPress ? Colors.white : u.textMuted),
                if (loading || icon != null) const SizedBox(width: 8),
                if (expand) Flexible(child: labelWidget) else labelWidget,
              ],
            ),
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
