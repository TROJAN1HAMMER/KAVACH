import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// `ReportRepository` (paths + download-to-file) is implemented against the
/// real `GET /reports/{id}` and `GET /reports/{id}/download/{type}`
/// endpoints. This screen needs a scan picker before it can call them —
/// wire it up from the Scan Details screen's "Reports" action in the next
/// milestone rather than duplicating a scan-selection UI here.
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.description_outlined,
      title: 'Reports',
      message: 'Open a completed scan from Scan Queue to download its PDF, '
          'SARIF, SBOM, CSV, or compliance report — ReportRepository is '
          'already wired to the real endpoints.',
    );
  }
}
