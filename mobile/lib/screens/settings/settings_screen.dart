import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// There is no "update my profile" (name/password) endpoint on the backend
/// — only admin-driven role/active-status changes on *other* users. A
/// theme toggle would be a real, connectable setting; deferred here since
/// the app is dark-only for this milestone (see `core/theme/app_theme.dart`).
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.settings_outlined,
      title: 'Settings',
      message: 'The backend has no self-service profile-update endpoint '
          'yet (change name/password) — see the milestone report\'s '
          'backend-gaps list.',
    );
  }
}
