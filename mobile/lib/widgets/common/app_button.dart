import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_radii.dart';

enum AppButtonVariant { primary, outlined, destructive, text }

/// Thin variant wrapper over the app's already-themed buttons. Gives every
/// async action the same busy-state treatment — a cross-fade between the
/// label and a spinner instead of the abrupt pop every screen previously
/// implemented ad hoc (`isBusy ? Spinner : Text`) — plus a consistent
/// haptic tap and, for [AppButtonVariant.destructive], the danger styling
/// every "cancel"/"delete" action previously hand-colored itself.
class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.icon,
    this.isBusy = false,
    this.expand = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool isBusy;
  final bool expand;

  bool get _isDestructive => variant == AppButtonVariant.destructive;

  void _handleTap() {
    if (isBusy || onPressed == null) return;
    _isDestructive ? HapticFeedback.mediumImpact() : HapticFeedback.lightImpact();
    onPressed!();
  }

  Color get _spinnerColor {
    switch (variant) {
      case AppButtonVariant.primary:
        return AppColors.primaryForeground;
      case AppButtonVariant.destructive:
        return AppColors.danger;
      case AppButtonVariant.outlined:
      case AppButtonVariant.text:
        return AppColors.primary;
    }
  }

  Widget _buildChild() {
    return AnimatedSwitcher(
      duration: AppMotion.fast,
      switchInCurve: AppMotion.switchCurve,
      switchOutCurve: AppMotion.switchCurve,
      child: isBusy
          ? SizedBox(
              key: const ValueKey('busy'),
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: _spinnerColor),
            )
          : Row(
              key: const ValueKey('label'),
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18),
                  const SizedBox(width: 8),
                ],
                Text(label),
              ],
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool disabled = onPressed == null || isBusy;
    final VoidCallback? handler = disabled ? null : _handleTap;

    Widget button;
    switch (variant) {
      case AppButtonVariant.primary:
        button = ElevatedButton(onPressed: handler, child: _buildChild());
      case AppButtonVariant.outlined:
        button = OutlinedButton(onPressed: handler, child: _buildChild());
      case AppButtonVariant.text:
        button = TextButton(onPressed: handler, child: _buildChild());
      case AppButtonVariant.destructive:
        button = OutlinedButton(
          onPressed: handler,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.danger,
            side: BorderSide(color: AppColors.danger.withValues(alpha: 0.5)),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            shape: const RoundedRectangleBorder(borderRadius: AppRadii.controlRadius),
          ),
          child: _buildChild(),
        );
    }

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
