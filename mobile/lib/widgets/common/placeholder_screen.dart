import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import 'empty_state.dart';

/// Shared shell for the screens this milestone scaffolds navigation-and-UI
/// for but does not yet wire to a live endpoint (per the brief: "placeholder
/// widgets where APIs are not yet connected"). Responsive via the standard
/// `SafeArea` + centered, width-capped content pattern used everywhere else
/// in the app.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    required this.icon,
    required this.title,
    required this.message,
    this.actions,
    super.key,
  });

  final IconData icon;
  final String title;
  final String message;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: EmptyState(
            icon: icon,
            title: title,
            message: message,
            action: actions != null
                ? Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    alignment: WrapAlignment.center,
                    children: actions!,
                  )
                : null,
          ),
        ),
      ),
    );
  }
}
