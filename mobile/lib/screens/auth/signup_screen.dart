import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/app_snackbar.dart';
import '../../widgets/common/kavach_logo.dart';

/// `POST /auth/register` takes no `role` — new accounts are always created
/// at the backend's least-privileged default and can only be promoted by an
/// admin via `PATCH /auth/admin/users/{id}/role`. There is deliberately no
/// role picker on this screen.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final bool success = await ref.read(authProvider.notifier).signup(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          fullName: _nameController.text.trim().isEmpty
              ? null
              : _nameController.text.trim(),
        );
    if (!success && mounted) {
      final String? error = ref.read(authProvider).error;
      AppSnackbar.error(context, error ?? 'Sign up failed. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isBusy = ref.watch(authProvider).isBusy;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl, vertical: AppSpacing.xxxl),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton(
                  onPressed: () => context.canPop()
                      ? context.pop()
                      : context.go(RoutePaths.landing),
                  icon: const Icon(Icons.arrow_back),
                  padding: EdgeInsets.zero,
                ),
                const SizedBox(height: AppSpacing.sm),
                const KavachLogo(heroTag: KavachLogo.sharedHeroTag),
                const SizedBox(height: AppSpacing.xxl + 4),
                Text('Create your account', style: textTheme.headlineSmall)
                    .animate()
                    .fadeIn(duration: AppMotion.medium, curve: AppMotion.entranceCurve)
                    .slideY(begin: 0.08, end: 0, duration: AppMotion.medium, curve: AppMotion.entranceCurve),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'New accounts start with read-only-style access; an '
                  'administrator can grant more.',
                  style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground),
                ).animate(delay: AppMotion.fast).fadeIn(duration: AppMotion.medium),
                const SizedBox(height: AppSpacing.xxl),
                TextFormField(
                  controller: _nameController,
                  autofillHints: const [AutofillHints.name],
                  decoration: const InputDecoration(
                    labelText: 'Full name (optional)',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ).animate(delay: AppMotion.medium).fadeIn(duration: AppMotion.medium),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.mail_outline),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Email is required';
                    }
                    if (!value.contains('@')) {
                      return 'Enter a valid email address';
                    }
                    return null;
                  },
                ).animate(delay: AppMotion.medium + AppMotion.fast).fadeIn(duration: AppMotion.medium),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      onPressed: () => setState(
                        () => _obscurePassword = !_obscurePassword,
                      ),
                    ),
                    helperText: 'At least 8 characters',
                  ),
                  validator: (value) {
                    if (value == null || value.length < 8) {
                      return 'Password must be at least 8 characters';
                    }
                    if (value.length > 128) {
                      return 'Password must be under 128 characters';
                    }
                    return null;
                  },
                  onFieldSubmitted: (_) => _submit(),
                ).animate(delay: AppMotion.slow).fadeIn(duration: AppMotion.medium),
                const SizedBox(height: AppSpacing.xxl),
                AppButton(
                  label: 'Create Account',
                  expand: true,
                  isBusy: isBusy,
                  onPressed: _submit,
                ),
                const SizedBox(height: AppSpacing.lg),
                Center(
                  child: TextButton(
                    onPressed: () => context.push(RoutePaths.login),
                    child: const Text('Already have an account? Log in'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
