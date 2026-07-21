/// Central registry of every path string used by `GoRouter`, so screens
/// navigate via these constants instead of hand-typed strings.
class RoutePaths {
  const RoutePaths._();

  static const String splash = '/splash';
  static const String landing = '/landing';
  static const String login = '/login';
  static const String signup = '/signup';

  static const String dashboard = '/dashboard';
  static const String repositories = '/repositories';
  static const String repositoryDetails = '/repositories/:repositoryId';
  static const String startScan = '/scans/start';
  static const String scanQueue = '/scans';
  static const String scanDetails = '/scans/:scanJobId';
  static const String risk = '/risk';
  static const String findings = '/findings';
  static const String compliance = '/compliance';
  static const String reports = '/reports';
  static const String executive = '/executive';
  static const String architecture = '/architecture';
  static const String notifications = '/notifications';
  static const String profile = '/profile';
  static const String settings = '/settings';
  static const String about = '/about';

  static String repositoryDetailsPath(String repositoryId) =>
      '/repositories/$repositoryId';
  static String scanDetailsPath(String scanJobId) => '/scans/$scanJobId';
}
