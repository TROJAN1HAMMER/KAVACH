/// Backend connection settings.
///
/// The backend is the single source of truth — this app only ever consumes
/// `/api/v1/*` routes that already exist on the FastAPI service. See
/// `docs/mobile_backend_gaps.md` for endpoints the mobile UI would need that
/// do not exist yet (do not invent client-side substitutes for those).
class ApiConstants {
  const ApiConstants._();

  /// Overridable at build time: `flutter run --dart-define=API_BASE_URL=...`
  /// Defaults to the docker-compose backend port used by the rest of the repo.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 60);

  // Auth
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String me = '/auth/me';

  // Repositories
  static const String repositories = '/repositories';
  static String repositoryScheduledScan(String repositoryId) =>
      '/repositories/$repositoryId/scheduled-scan';

  // Scans
  static const String scanUpload = '/scan';
  static const String scanFromRepoUrl = '/scan/repository';
  static String scanPremade(String riskLevel) => '/scan/premade/$riskLevel';
  static const String scanList = '/scan';
  static String scanDetail(String scanJobId) => '/scan/$scanJobId';
  static String scanCancel(String scanJobId) => '/scan/$scanJobId/cancel';
  static String scanWebSocket(String scanJobId) => '/scan/$scanJobId/ws';
  static String scanFindings(String scanJobId) => '/scan/$scanJobId/findings';
  static String scanCompliance(String scanJobId) => '/scan/$scanJobId/compliance';

  // Finding intelligence
  static String findingIntelligence(String findingId) =>
      '/findings/$findingId/intelligence';

  // Reports
  static String reportPaths(String scanJobId) => '/reports/$scanJobId';
  static String reportDownload(String scanJobId, String reportType) =>
      '/reports/$scanJobId/download/$reportType';

  // Risk configuration
  static const String riskModules = '/risk/modules';
  static String riskModule(String moduleName) => '/risk/modules/$moduleName';
  static const String riskFactorWeights = '/risk/factor-weights';
  static String riskFactorWeight(String factorName) =>
      '/risk/factor-weights/$factorName';
  static const String riskPreview = '/risk/preview';

  // Analytics
  static const String myActivity = '/analytics/my-activity';
  static const String teamActivity = '/analytics/team-activity';
}
