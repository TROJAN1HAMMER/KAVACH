import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';

/// Shared scan-status pill — previously a byte-identical private
/// `_StatusChip` duplicated in `scan_queue_screen.dart` and
/// `scan_details_screen.dart`. Same status→color mapping as before, plus a
/// small leading icon per status for quicker visual scanning.
class StatusChip extends StatelessWidget {
  const StatusChip({required this.status, super.key});

  final String status;

  Color get _color {
    switch (status) {
      case 'completed':
        return AppColors.success;
      case 'failed':
        return AppColors.danger;
      case 'running':
        return AppColors.primary;
      case 'cancelled':
        return AppColors.mutedForeground;
      default:
        return AppColors.warning;
    }
  }

  IconData get _icon {
    switch (status) {
      case 'completed':
        return Icons.check_circle_outline;
      case 'failed':
        return Icons.error_outline;
      case 'running':
        return Icons.autorenew;
      case 'cancelled':
        return Icons.block_outlined;
      default:
        return Icons.schedule_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final Color color = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: ShapeDecoration(
        color: color.withValues(alpha: 0.12),
        shape: AppRadii.pill.copyWith(side: BorderSide(color: color.withValues(alpha: 0.3))),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            status,
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
