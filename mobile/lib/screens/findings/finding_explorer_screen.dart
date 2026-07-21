import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// `FindingRepository` (findings-per-scan + per-finding intelligence) is
/// already implemented and ready to call — this screen just doesn't have a
/// cross-scan findings list/filter UI wired yet, since the backend doesn't
/// expose a "findings across all my scans" endpoint (only
/// `GET /scan/{id}/findings`, scoped to one scan). A real Finding Explorer
/// needs a composition decision (iterate scans, or add a backend endpoint)
/// before it can be built — see the milestone report.
class FindingExplorerScreen extends StatelessWidget {
  const FindingExplorerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.search_outlined,
      title: 'Finding Explorer',
      message: 'Findings are fetched per-scan today '
          '(GET /scan/{id}/findings) — open a scan from Scan Queue to see '
          'its findings. A cross-scan explorer needs a backend endpoint '
          'this milestone deliberately did not invent.',
    );
  }
}
