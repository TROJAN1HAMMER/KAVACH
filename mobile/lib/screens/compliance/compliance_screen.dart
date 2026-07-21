import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// Same shape as Finding Explorer: `ComplianceRepository` calls
/// `GET /scan/{id}/compliance` and is ready to use, but compliance is
/// scoped to a single scan on the backend — there's no portfolio-wide
/// compliance rollup endpoint yet.
class ComplianceScreen extends StatelessWidget {
  const ComplianceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.rule_outlined,
      title: 'Compliance',
      message: 'Compliance results are fetched per-scan '
          '(GET /scan/{id}/compliance) — open a scan to see its PCI DSS / '
          'RBI / SWIFT CSP control results. A portfolio-wide rollup needs a '
          'backend endpoint this milestone deliberately did not invent.',
    );
  }
}
