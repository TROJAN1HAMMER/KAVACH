import 'package:flutter/material.dart';

/// Color tokens lifted directly from the web app's dark theme
/// (`frontend/src/index.css`, `:root.dark { ... }`) so the mobile app reads
/// as the same product, not a reskin.
class AppColors {
  const AppColors._();

  static const Color background = Color(0xFF0D0D0D);
  static const Color foreground = Color(0xFFFFFFFF);

  static const Color card = Color(0xFF1A1A19);
  static const Color cardForeground = Color(0xFFFFFFFF);

  static const Color border = Color(0x1AFFFFFF); // rgba(255,255,255,0.1)

  static const Color input = Color(0xFF2C2C2A);

  static const Color primary = Color(0xFF3987E5);
  static const Color primaryForeground = Color(0xFF0D0D0D);

  static const Color secondary = Color(0xFF232322);
  static const Color secondaryForeground = Color(0xFFFFFFFF);

  static const Color muted = Color(0xFF232322);
  static const Color mutedForeground = Color(0xFFC3C2B7);

  static const Color accent = Color(0xFF16273B);
  static const Color accentForeground = Color(0xFF86B6EF);

  static const Color danger = Color(0xFFE66767);
  static const Color warning = Color(0xFFFAB219);
  static const Color success = Color(0xFF0CA30C);

  // Severity palette (dark-theme values), matching frontend/src/lib/severity.ts
  static const Color severityCritical = Color(0xFFE66767);
  static const Color severityHigh = Color(0xFFEC835A);
  static const Color severityMedium = Color(0xFFFAB219);
  static const Color severityLow = Color(0xFF0CA30C);
  static const Color severityInfo = Color(0xFF898781);

  static Color severityColor(String severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return severityCritical;
      case 'HIGH':
        return severityHigh;
      case 'MEDIUM':
        return severityMedium;
      case 'LOW':
        return severityLow;
      default:
        return severityInfo;
    }
  }

  // Categorical chart palette (dark values), frontend/src/lib/severity.ts CATEGORICAL_PALETTE
  static const List<Color> categorical = <Color>[
    Color(0xFF3987E5), // blue
    Color(0xFF008300), // green
    Color(0xFFD55181), // magenta
    Color(0xFFC98500), // yellow
    Color(0xFF199E70), // aqua
    Color(0xFFD95926), // orange
    Color(0xFF9085E9), // violet
    Color(0xFFE66767), // red
  ];
}
