import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_radii.dart';

/// Thin wrapper so every screen gets the themed `CardTheme` (see
/// `core/theme/app_theme.dart`) with consistent internal padding, matching
/// the web app's flat `bg-card` + 1px border + `rounded-xl` language (no
/// glassmorphism on ordinary cards — see the theme research notes).
///
/// When [onTap] is set, adds a light haptic tap and a themed ripple —
/// same tap target as before, just with feedback.
class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (onTap == null) {
      return Card(child: Padding(padding: padding, child: child));
    }
    return Card(
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap!();
        },
        borderRadius: AppRadii.cardRadius,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}
