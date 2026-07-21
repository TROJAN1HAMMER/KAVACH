import 'package:flutter/widgets.dart';

/// Material 3 window-size-class convention, generalizing the single ad hoc
/// 720px check that used to live only in `MainShell`. Width-based, so it
/// naturally covers both tablets and a phone rotated to landscape.
class AppBreakpoints {
  const AppBreakpoints._();

  static const double medium = 600;
  static const double expanded = 840;

  static bool isCompact(BuildContext context) =>
      MediaQuery.sizeOf(context).width < medium;

  static bool isMedium(BuildContext context) {
    final double width = MediaQuery.sizeOf(context).width;
    return width >= medium && width < expanded;
  }

  static bool isExpanded(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= expanded;

  /// Number of columns a stat/card grid should use at the current width.
  static int gridColumns(BuildContext context) {
    final double width = MediaQuery.sizeOf(context).width;
    if (width >= expanded) return 4;
    if (width >= medium) return 3;
    return 2;
  }
}
