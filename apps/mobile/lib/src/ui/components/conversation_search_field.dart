import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// Presentation only: query, account fencing and debounce belong to the caller.
class ConversationSearchField extends StatelessWidget {
  const ConversationSearchField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onChanged,
    required this.onClear,
    this.clearTooltip,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final String? clearTooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (context, value, _) => TextField(
          controller: controller,
          onChanged: onChanged,
          maxLines: 1,
          textInputAction: TextInputAction.search,
          style: TextStyle(fontSize: 16, color: colors.textPrimary),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: TextStyle(fontSize: 16, color: colors.textMuted),
            filled: true,
            fillColor: colors.surfaceBg,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
            prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 24),
            suffixIcon: value.text.isEmpty
                ? null
                : IconButton(
                    tooltip:
                        clearTooltip ??
                        MaterialLocalizations.of(context).deleteButtonTooltip,
                    icon: const Icon(Icons.clear),
                    onPressed: () {
                      controller.clear();
                      onClear();
                    },
                  ),
            border: border,
            enabledBorder: border,
            focusedBorder: border,
          ),
        ),
      ),
    );
  }
}
