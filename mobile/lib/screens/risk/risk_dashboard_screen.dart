import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// BRS/attack-surface numbers exist per-scan (`ScanJob.brsScore` etc.) and as
/// aggregates (`MyActivitySummary.averageBrsScore`) but there is no
/// dedicated "risk trend over time" endpoint — see the milestone report's
/// backend-gaps list. This screen is scaffolded (nav + RBAC gating) but the
/// chart/trend view is next-milestone work once the composition strategy
/// (probably: fold `GET /scan` + `GET /analytics/my-activity` into a trend)
/// is decided.
class RiskDashboardScreen extends StatelessWidget {
  const RiskDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.shield_outlined,
      title: 'Risk Dashboard',
      message: 'BRS trend charts land here in the next milestone, composed '
          'from GET /scan and GET /analytics/my-activity — there is no '
          'single risk-trend endpoint on the backend yet.',
    );
  }
}
