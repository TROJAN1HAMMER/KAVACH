import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_spacing.dart';

/// Consistent, icon-led SnackBars — replaces every screen's ad hoc
/// `ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(...)))`
/// call (same trigger points, same messages, just a shared visual language
/// with a color-coded accent instead of the generic default `SnackBarTheme`).
class AppSnackbar {
  const AppSnackbar._();

  static void success(BuildContext context, String message) =>
      _show(context, message, icon: Icons.check_circle_outline, accent: AppColors.success);

  static void error(BuildContext context, String message) =>
      _show(context, message, icon: Icons.error_outline, accent: AppColors.danger);

  static void info(BuildContext context, String message) =>
      _show(context, message, icon: Icons.info_outline, accent: AppColors.primary);

  static void _show(
    BuildContext context,
    String message, {
    required IconData icon,
    required Color accent,
  }) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(icon, color: accent, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(message)),
            ],
          ),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadii.controlRadius,
            side: BorderSide(color: accent.withValues(alpha: 0.35)),
          ),
        ),
      );
  }
}
