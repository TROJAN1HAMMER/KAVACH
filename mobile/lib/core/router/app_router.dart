import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_provider.dart';
import '../../screens/about/about_screen.dart';
import '../../screens/architecture/architecture_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/signup_screen.dart';
import '../../screens/compliance/compliance_screen.dart';
import '../../screens/dashboard/dashboard_screen.dart';
import '../../screens/executive/executive_summary_screen.dart';
import '../../screens/findings/finding_explorer_screen.dart';
import '../../screens/landing/landing_screen.dart';
import '../../screens/notifications/notifications_screen.dart';
import '../../screens/profile/profile_screen.dart';
import '../../screens/reports/reports_screen.dart';
import '../../screens/repositories/repository_details_screen.dart';
import '../../screens/repositories/repositories_screen.dart';
import '../../screens/risk/risk_dashboard_screen.dart';
import '../../screens/scans/scan_details_screen.dart';
import '../../screens/scans/scan_queue_screen.dart';
import '../../screens/scans/start_scan_screen.dart';
import '../../screens/settings/settings_screen.dart';
import '../../screens/splash/splash_screen.dart';
import '../../widgets/layout/main_shell.dart';
import '../rbac/rbac.dart';
import '../rbac/route_keys.dart';
import 'route_paths.dart';

/// Notifies `GoRouter` to re-run `redirect` whenever [AuthNotifier]'s state
/// changes (login, logout, session restore) — `GoRouter` only re-evaluates
/// redirects on navigation or when its `refreshListenable` fires.
class _RouterRefreshListenable extends ChangeNotifier {
  _RouterRefreshListenable(Ref ref) {
    ref.listen<AuthState>(authProvider, (previous, next) {
      if (previous?.status != next.status) {
        notifyListeners();
      }
    });
  }
}

const List<String> _publicPaths = <String>[
  RoutePaths.splash,
  RoutePaths.landing,
  RoutePaths.login,
  RoutePaths.signup,
];

/// Maps a top-level path segment to the [RouteKey] that gates it. Nested
/// paths (`/repositories/:id`, `/scans/:id`) share their parent's key.
RouteKey? _routeKeyForLocation(String location) {
  final List<String> segments = Uri.parse(location).pathSegments;
  final String segment = segments.isEmpty ? '' : segments.first;
  switch (segment) {
    case 'dashboard':
      return RouteKey.dashboard;
    case 'repositories':
      return RouteKey.repositories;
    case 'scans':
      return RouteKey.scans;
    case 'risk':
      return RouteKey.risk;
    case 'compliance':
      return RouteKey.compliance;
    case 'findings':
      return RouteKey.findings;
    case 'executive':
      return RouteKey.executive;
    case 'architecture':
      return RouteKey.architecture;
    case 'reports':
      return RouteKey.reports;
    case 'notifications':
      return RouteKey.notifications;
    case 'profile':
      return RouteKey.profile;
    case 'settings':
      return RouteKey.settings;
    case 'about':
      return RouteKey.about;
    default:
      return null;
  }
}

final goRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = _RouterRefreshListenable(ref);

  return GoRouter(
    initialLocation: RoutePaths.splash,
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final AuthState authState = ref.read(authProvider);
      final String location = state.uri.toString();
      final bool onPublicPath = _publicPaths.any(location.startsWith);

      if (authState.status == AuthStatus.unknown) {
        return location == RoutePaths.splash ? null : RoutePaths.splash;
      }

      if (authState.status == AuthStatus.unauthenticated) {
        if (location == RoutePaths.splash) {
          return RoutePaths.landing;
        }
        return onPublicPath ? null : RoutePaths.landing;
      }

      // Authenticated from here down.
      if (onPublicPath) {
        return defaultRouteForRole(authState.user?.role);
      }
      final RouteKey? routeKey = _routeKeyForLocation(location);
      if (routeKey != null && !canAccessRoute(authState.user?.role, routeKey)) {
        return defaultRouteForRole(authState.user?.role);
      }
      return null;
    },
    routes: [
      GoRoute(
        path: RoutePaths.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: RoutePaths.landing,
        builder: (context, state) => const LandingScreen(),
      ),
      GoRoute(
        path: RoutePaths.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: RoutePaths.signup,
        builder: (context, state) => const SignupScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return MainShell(currentPath: state.uri.toString(), child: child);
        },
        routes: [
          GoRoute(
            path: RoutePaths.dashboard,
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: RoutePaths.repositories,
            builder: (context, state) => const RepositoriesScreen(),
          ),
          GoRoute(
            path: RoutePaths.repositoryDetails,
            builder: (context, state) => RepositoryDetailsScreen(
              repositoryId: state.pathParameters['repositoryId']!,
            ),
          ),
          GoRoute(
            path: RoutePaths.startScan,
            builder: (context, state) => const StartScanScreen(),
          ),
          GoRoute(
            path: RoutePaths.scanQueue,
            builder: (context, state) => const ScanQueueScreen(),
          ),
          GoRoute(
            path: RoutePaths.scanDetails,
            builder: (context, state) => ScanDetailsScreen(
              scanJobId: state.pathParameters['scanJobId']!,
            ),
          ),
          GoRoute(
            path: RoutePaths.risk,
            builder: (context, state) => const RiskDashboardScreen(),
          ),
          GoRoute(
            path: RoutePaths.findings,
            builder: (context, state) => const FindingExplorerScreen(),
          ),
          GoRoute(
            path: RoutePaths.compliance,
            builder: (context, state) => const ComplianceScreen(),
          ),
          GoRoute(
            path: RoutePaths.reports,
            builder: (context, state) => const ReportsScreen(),
          ),
          GoRoute(
            path: RoutePaths.executive,
            builder: (context, state) => const ExecutiveSummaryScreen(),
          ),
          GoRoute(
            path: RoutePaths.architecture,
            builder: (context, state) => const ArchitectureScreen(),
          ),
          GoRoute(
            path: RoutePaths.notifications,
            builder: (context, state) => const NotificationsScreen(),
          ),
          GoRoute(
            path: RoutePaths.profile,
            builder: (context, state) => const ProfileScreen(),
          ),
          GoRoute(
            path: RoutePaths.settings,
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: RoutePaths.about,
            builder: (context, state) => const AboutScreen(),
          ),
        ],
      ),
    ],
  );
});
