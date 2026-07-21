import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/storage/secure_storage_service.dart';
import '../repositories/analytics_repository.dart';
import '../repositories/auth_repository.dart';
import '../repositories/compliance_repository.dart';
import '../repositories/finding_repository.dart';
import '../repositories/report_repository.dart';
import '../repositories/repositories_repository.dart';
import '../repositories/scan_repository.dart';
import '../services/analytics_service.dart';
import '../services/auth_service.dart';
import '../services/finding_intelligence_service.dart';
import '../services/report_service.dart';
import '../services/repository_service.dart';
import '../services/risk_service.dart';
import '../services/scan_service.dart';
import 'auth_provider.dart';

/// The dependency-injection graph: Storage -> ApiClient -> Services ->
/// Repositories -> (consumed by) feature providers/screens. Everything here
/// is a plain, eagerly-cheap `Provider` — no network calls happen just from
/// reading these, only from calling a repository method.

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    storage: ref.read(secureStorageProvider),
    onSessionExpired: () async {
      await ref.read(authProvider.notifier).forceLogout();
    },
  );
});

// --- Services -------------------------------------------------------------

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.read(apiClientProvider).dio);
});

final repositoryServiceProvider = Provider<RepositoryService>((ref) {
  return RepositoryService(ref.read(apiClientProvider).dio);
});

final scanServiceProvider = Provider<ScanService>((ref) {
  return ScanService(ref.read(apiClientProvider).dio);
});

final reportServiceProvider = Provider<ReportService>((ref) {
  return ReportService(ref.read(apiClientProvider).dio);
});

final riskServiceProvider = Provider<RiskService>((ref) {
  return RiskService(ref.read(apiClientProvider).dio);
});

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService(ref.read(apiClientProvider).dio);
});

final findingIntelligenceServiceProvider =
    Provider<FindingIntelligenceService>((ref) {
  return FindingIntelligenceService(ref.read(apiClientProvider).dio);
});

// --- Repositories -----------------------------------------------------------

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    authService: ref.read(authServiceProvider),
    storage: ref.read(secureStorageProvider),
  );
});

final repositoriesRepositoryProvider = Provider<RepositoriesRepository>((ref) {
  return RepositoriesRepository(ref.read(repositoryServiceProvider));
});

final scanRepositoryProvider = Provider<ScanRepository>((ref) {
  return ScanRepository(ref.read(scanServiceProvider));
});

final findingRepositoryProvider = Provider<FindingRepository>((ref) {
  return FindingRepository(
    scanService: ref.read(scanServiceProvider),
    intelligenceService: ref.read(findingIntelligenceServiceProvider),
  );
});

final complianceRepositoryProvider = Provider<ComplianceRepository>((ref) {
  return ComplianceRepository(ref.read(scanServiceProvider));
});

final reportRepositoryProvider = Provider<ReportRepository>((ref) {
  return ReportRepository(ref.read(reportServiceProvider));
});

final analyticsRepositoryProvider = Provider<AnalyticsRepository>((ref) {
  return AnalyticsRepository(ref.read(analyticsServiceProvider));
});
