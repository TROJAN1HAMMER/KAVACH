import 'package:flutter/material.dart';

/// Title + optional trailing action — replaces the ad hoc
/// `Row(mainAxisAlignment: spaceBetween, ...)` pattern each screen
/// reimplemented for headings like Dashboard's "Recent scans / View all".
class SectionHeader extends StatelessWidget {
  const SectionHeader({required this.title, this.action, super.key});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        if (action != null) action!,
      ],
    );
  }
}
