import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import 'app_card.dart';

/// Shared stat/metric tile — previously reimplemented independently as a
/// private `_StatTile` in both `dashboard_screen.dart` and
/// `scan_details_screen.dart`. Same visual contract as before (label above
/// value inside an `AppCard`), plus an optional leading icon and a subtle
/// entrance animation.
class StatTile extends StatelessWidget {
  const StatTile({
    required this.label,
    required this.value,
    this.icon,
    this.iconColor,
    this.trailing,
    super.key,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Color? iconColor;

  /// Rendered next to the value — used by Scan Details to show a
  /// [SeverityBadge] beside the BRS score.
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 20, color: iconColor ?? AppColors.mutedForeground),
            const SizedBox(height: AppSpacing.sm),
          ],
          Text(label, style: textTheme.bodySmall),
          const SizedBox(height: AppSpacing.xs + 2),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(value, style: textTheme.headlineSmall),
              if (trailing != null) ...[
                const SizedBox(width: AppSpacing.sm),
                trailing!,
              ],
            ],
          ),
        ],
      ),
    ).animate().fadeIn(duration: AppMotion.medium, curve: AppMotion.entranceCurve).slideY(
          begin: 0.08,
          end: 0,
          duration: AppMotion.medium,
          curve: AppMotion.entranceCurve,
        );
  }
}
