import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/core_providers.dart';
import '../../providers/repositories_provider.dart';
import '../../providers/scan_provider.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/app_snackbar.dart';

enum _ScanSource { zipUpload, repositoryUrl }

/// Real end-to-end screen: submits to `POST /scan` (zip upload, via
/// `file_picker`) or `POST /scan/repository` (URL submit). Cancels via
/// `ScanRepository.cancel` are wired on the Scan Details screen.
class StartScanScreen extends ConsumerStatefulWidget {
  const StartScanScreen({super.key});

  @override
  ConsumerState<StartScanScreen> createState() => _StartScanScreenState();
}

class _StartScanScreenState extends ConsumerState<StartScanScreen> {
  _ScanSource _source = _ScanSource.repositoryUrl;
  final _urlController = TextEditingController();
  final _refController = TextEditingController();
  String _priority = 'normal';
  PlatformFile? _pickedZip;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _urlController.dispose();
    _refController.dispose();
    super.dispose();
  }

  Future<void> _pickZip() async {
    // Only Android needs an explicit runtime grant for file access; iOS's
    // document picker (which file_picker uses under the hood) needs none.
    if (Platform.isAndroid) {
      final PermissionStatus status = await Permission.storage.request();
      if (status.isPermanentlyDenied) {
        _showError(
          'Storage access is required to attach a .zip file. Enable it in '
          'system settings.',
        );
        return;
      }
    }
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['zip'],
    );
    if (result != null && result.files.isNotEmpty) {
      setState(() => _pickedZip = result.files.single);
    }
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      if (_source == _ScanSource.zipUpload) {
        final PlatformFile? file = _pickedZip;
        if (file == null || file.path == null) {
          _showError('Choose a .zip file first.');
          return;
        }
        await ref.read(scanRepositoryProvider).uploadZip(
              filePath: file.path!,
              fileName: file.name,
              priority: _priority,
            );
      } else {
        final String url = _urlController.text.trim();
        if (url.isEmpty) {
          _showError('Enter a repository URL.');
          return;
        }
        await ref.read(scanRepositoryProvider).submitRepositoryUrl(
              repoUrl: url,
              ref: _refController.text.trim().isEmpty
                  ? null
                  : _refController.text.trim(),
              priority: _priority,
            );
      }
      ref.invalidate(scanJobListProvider);
      ref.invalidate(repositoriesListProvider);
      if (mounted) {
        context.go(RoutePaths.scanQueue);
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showError(String message) {
    setState(() => _isSubmitting = false);
    if (mounted) {
      AppSnackbar.error(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Start Scan')),
      body: SafeArea(
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            SegmentedButton<_ScanSource>(
              segments: const [
                ButtonSegment(
                  value: _ScanSource.repositoryUrl,
                  label: Text('Repository URL'),
                  icon: Icon(Icons.link),
                ),
                ButtonSegment(
                  value: _ScanSource.zipUpload,
                  label: Text('Upload ZIP'),
                  icon: Icon(Icons.upload_file_outlined),
                ),
              ],
              selected: {_source},
              onSelectionChanged: (selection) =>
                  setState(() => _source = selection.first),
            ),
            const SizedBox(height: AppSpacing.xl),
            if (_source == _ScanSource.repositoryUrl) ...[
              TextField(
                controller: _urlController,
                decoration: const InputDecoration(
                  labelText: 'Repository URL',
                  hintText: 'https://github.com/org/repo.git',
                  prefixIcon: Icon(Icons.storage_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _refController,
                decoration: const InputDecoration(
                  labelText: 'Branch / ref (optional)',
                  prefixIcon: Icon(Icons.call_split),
                ),
              ),
            ] else ...[
              AppButton(
                label: _pickedZip?.name ?? 'Choose .zip file',
                icon: Icons.attach_file,
                variant: AppButtonVariant.outlined,
                onPressed: _pickZip,
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Text('Priority', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: AppSpacing.sm),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'low', label: Text('Low')),
                ButtonSegment(value: 'normal', label: Text('Normal')),
                ButtonSegment(value: 'high', label: Text('High')),
              ],
              selected: {_priority},
              onSelectionChanged: (selection) =>
                  setState(() => _priority = selection.first),
            ),
            const SizedBox(height: AppSpacing.xxl),
            AppButton(
              label: 'Start Scan',
              expand: true,
              isBusy: _isSubmitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
