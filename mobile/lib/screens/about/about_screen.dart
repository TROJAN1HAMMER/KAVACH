import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/info_row.dart';
import '../../widgets/common/kavach_logo.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const KavachLogo(iconSize: 48)
                      .animate()
                      .fadeIn(duration: AppMotion.medium, curve: AppMotion.entranceCurve)
                      .scaleXY(begin: 0.92, end: 1, duration: AppMotion.medium),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    AppConstants.appTagline,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppCard(
                    child: Column(
                      children: const [
                        InfoRow(label: 'Version', value: '0.1.0', showDivider: true),
                        InfoRow(label: 'Platform', value: 'Flutter mobile client'),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: 'View source repository',
                    icon: Icons.open_in_new,
                    variant: AppButtonVariant.text,
                    onPressed: () => launchUrl(
                      Uri.parse('https://github.com'),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
