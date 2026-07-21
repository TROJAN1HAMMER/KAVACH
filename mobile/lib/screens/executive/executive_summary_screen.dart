import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// The backend's executive-intelligence endpoints
/// (`/executive-intelligence/*`) are RAG-backed — out of scope per the
/// brief ("Do NOT implement RAG"). This screen is scaffolded for
/// auditor/read_only's default landing route (see
/// `core/rbac/rbac.dart::kDefaultRouteForRole`) but intentionally has no
/// backend call wired.
class ExecutiveSummaryScreen extends StatelessWidget {
  const ExecutiveSummaryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.bar_chart_outlined,
      title: 'Executive Summary',
      message: 'The backend\'s executive-intelligence endpoints are '
          'RAG-based and out of scope for this milestone by design.',
    );
  }
}
