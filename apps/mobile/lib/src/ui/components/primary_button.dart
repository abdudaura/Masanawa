import 'package:flutter/material.dart';

import '../../theme/unigeria_theme.dart';
import '../../tokens/unigeria_tokens.dart';

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
    final u = context.unigeria;
    final canPress = enabled && !loading && onPressed != null;
    final button = Material(
      color: canPress ? u.brand : u.surfaceMuted,
      borderRadius: BorderRadius.circular(UnigeriaTokens.radius['lg']!),
      child: InkWell(
        onTap: canPress ? onPressed : null,
        borderRadius: BorderRadius.circular(UnigeriaTokens.radius['lg']!),
        child: SizedBox(
          height: UnigeriaTokens.touchTargetMin + 4,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
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
                Text(
                  label,
                  style: TextStyle(
                    color: canPress ? Colors.white : u.textMuted,
                    fontSize: UnigeriaTokens.fontSize['md'],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
