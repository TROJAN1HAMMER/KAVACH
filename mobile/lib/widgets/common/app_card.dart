import 'package:flutter/material.dart';

/// Thin wrapper so every screen gets the themed `CardTheme` (see
/// `core/theme/app_theme.dart`) with consistent internal padding, matching
/// the web app's flat `bg-card` + 1px border + `rounded-xl` language (no
/// glassmorphism on ordinary cards — see the theme research notes).
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
    final card = Card(
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) {
      return card;
    }
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}
