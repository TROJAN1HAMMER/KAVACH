import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// Shared key/value row — previously an identically-shaped private
/// `_InfoRow` duplicated in `scan_details_screen.dart` and
/// `repository_details_screen.dart`. Adds an optional divider between rows
/// so a stack of these reads as a structured data table rather than a
/// plain form.
class InfoRow extends StatelessWidget {
  const InfoRow({
    required this.label,
    required this.value,
    this.showDivider = false,
    super.key,
  });

  final String label;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground)),
              Text(value, style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
          if (showDivider) ...[
            const SizedBox(height: AppSpacing.sm),
            const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}
