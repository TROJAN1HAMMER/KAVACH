import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// The backend has no notifications API at all — see
/// `lib/models/local_notification.dart`'s docstring and the milestone
/// report's backend-gaps list. Do not wire this to a fabricated
/// `/notifications` endpoint; it does not exist.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.notifications_outlined,
      title: 'Notifications',
      message: 'The backend has no notifications API — this will surface '
          'local, in-app events only (e.g. "scan completed"), the same way '
          'the web app\'s toast system works today.',
    );
  }
}
