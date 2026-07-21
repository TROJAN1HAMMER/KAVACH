import 'package:flutter/material.dart';

import '../../widgets/common/placeholder_screen.dart';

/// The web app's System Architecture page is a bespoke react-three-fiber 3D
/// scene (`frontend/src/components/architecture/scene3d/*`) — not something
/// to port field-for-field like a data screen. Scaffolded here as a nav
/// destination; a mobile-appropriate visualization (likely a simpler 2D
/// diagram, given typical mobile GPU/perf constraints) is next-milestone
/// design work, not a backend-integration task.
class ArchitectureScreen extends StatelessWidget {
  const ArchitectureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      icon: Icons.hub_outlined,
      title: 'System Architecture',
      message: 'The web app\'s 3D architecture explorer needs a '
          'mobile-appropriate redesign (likely 2D) rather than a direct '
          'port — design work for the next milestone.',
    );
  }
}
