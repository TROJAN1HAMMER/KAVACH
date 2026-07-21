import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../core/theme/app_radii.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme_extension.dart';

/// A single shimmering placeholder box. Building block for the layout-shaped
/// skeletons below — sized to roughly match the real content it stands in
/// for, so loading no longer "pops" once data arrives.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    required this.width,
    required this.height,
    this.radius = AppRadii.control,
    super.key,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: context.kavachColors.shimmerBase,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Wraps any skeleton layout in the shimmer sweep. One shimmer wraps a
/// whole group of [SkeletonBox]es so the light sweeps across all of them
/// together, rather than each box shimmering independently.
class ShimmerGroup extends StatelessWidget {
  const ShimmerGroup({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.kavachColors;
    return Shimmer.fromColors(
      baseColor: colors.shimmerBase,
      highlightColor: colors.shimmerHighlight,
      period: const Duration(milliseconds: 1400),
      child: child,
    );
  }
}

/// Shaped like the Dashboard's 2x2 stat grid + "Findings by severity" card,
/// so its loading state matches the eventual layout instead of a bare
/// centered spinner.
class StatGridSkeleton extends StatelessWidget {
  const StatGridSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Expanded(child: SkeletonBox(width: double.infinity, height: 84, radius: AppRadii.card)),
              SizedBox(width: AppSpacing.md),
              Expanded(child: SkeletonBox(width: double.infinity, height: 84, radius: AppRadii.card)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: const [
              Expanded(child: SkeletonBox(width: double.infinity, height: 84, radius: AppRadii.card)),
              SizedBox(width: AppSpacing.md),
              Expanded(child: SkeletonBox(width: double.infinity, height: 84, radius: AppRadii.card)),
            ],
          ),
          const SizedBox(height: AppSpacing.xxl),
          const SkeletonBox(width: 140, height: 16, radius: 4),
          const SizedBox(height: AppSpacing.md),
          const SkeletonBox(width: double.infinity, height: 64, radius: AppRadii.card),
        ],
      ),
    );
  }
}

/// N stacked card-row placeholders — for any list screen (Repositories,
/// Scan Queue, Recent Scans) while its provider is loading.
class ListRowSkeleton extends StatelessWidget {
  const ListRowSkeleton({this.count = 4, super.key});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ShimmerGroup(
      child: Column(
        children: [
          for (int i = 0; i < count; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: const SkeletonBox(width: double.infinity, height: 72, radius: AppRadii.card),
            ),
        ],
      ),
    );
  }
}
