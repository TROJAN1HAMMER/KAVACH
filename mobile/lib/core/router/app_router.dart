import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
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
import '../theme/app_motion.dart';
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

/// Wraps every route's screen in the same subtle fade+slide transition
/// (using the app-wide [AppMotion] timing) instead of go_router's default
/// abrupt platform transition — purely a presentation change, the route's
/// path/builder-content/redirect behavior is untouched.
CustomTransitionPage<void> _transitionPage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    transitionDuration: AppMotion.medium,
    reverseTransitionDuration: AppMotion.medium,
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final CurvedAnimation curved = CurvedAnimation(
        parent: animation,
        curve: AppMotion.entranceCurve,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.03),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
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
        pageBuilder: (context, state) => _transitionPage(state, const SplashScreen()),
      ),
      GoRoute(
        path: RoutePaths.landing,
        pageBuilder: (context, state) => _transitionPage(state, const LandingScreen()),
      ),
      GoRoute(
        path: RoutePaths.login,
        pageBuilder: (context, state) => _transitionPage(state, const LoginScreen()),
      ),
      GoRoute(
        path: RoutePaths.signup,
        pageBuilder: (context, state) => _transitionPage(state, const SignupScreen()),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return MainShell(currentPath: state.uri.toString(), child: child);
        },
        routes: [
          GoRoute(
            path: RoutePaths.dashboard,
            pageBuilder: (context, state) => _transitionPage(state, const DashboardScreen()),
          ),
          GoRoute(
            path: RoutePaths.repositories,
            pageBuilder: (context, state) => _transitionPage(state, const RepositoriesScreen()),
          ),
          GoRoute(
            path: RoutePaths.repositoryDetails,
            pageBuilder: (context, state) => _transitionPage(
              state,
              RepositoryDetailsScreen(
                repositoryId: state.pathParameters['repositoryId']!,
              ),
            ),
          ),
          GoRoute(
            path: RoutePaths.startScan,
            pageBuilder: (context, state) => _transitionPage(state, const StartScanScreen()),
          ),
          GoRoute(
            path: RoutePaths.scanQueue,
            pageBuilder: (context, state) => _transitionPage(state, const ScanQueueScreen()),
          ),
          GoRoute(
            path: RoutePaths.scanDetails,
            pageBuilder: (context, state) => _transitionPage(
              state,
              ScanDetailsScreen(scanJobId: state.pathParameters['scanJobId']!),
            ),
          ),
          GoRoute(
            path: RoutePaths.risk,
            pageBuilder: (context, state) => _transitionPage(state, const RiskDashboardScreen()),
          ),
          GoRoute(
            path: RoutePaths.findings,
            pageBuilder: (context, state) => _transitionPage(state, const FindingExplorerScreen()),
          ),
          GoRoute(
            path: RoutePaths.compliance,
            pageBuilder: (context, state) => _transitionPage(state, const ComplianceScreen()),
          ),
          GoRoute(
            path: RoutePaths.reports,
            pageBuilder: (context, state) => _transitionPage(state, const ReportsScreen()),
          ),
          GoRoute(
            path: RoutePaths.executive,
            pageBuilder: (context, state) => _transitionPage(state, const ExecutiveSummaryScreen()),
          ),
          GoRoute(
            path: RoutePaths.architecture,
            pageBuilder: (context, state) => _transitionPage(state, const ArchitectureScreen()),
          ),
          GoRoute(
            path: RoutePaths.notifications,
            pageBuilder: (context, state) => _transitionPage(state, const NotificationsScreen()),
          ),
          GoRoute(
            path: RoutePaths.profile,
            pageBuilder: (context, state) => _transitionPage(state, const ProfileScreen()),
          ),
          GoRoute(
            path: RoutePaths.settings,
            pageBuilder: (context, state) => _transitionPage(state, const SettingsScreen()),
          ),
          GoRoute(
            path: RoutePaths.about,
            pageBuilder: (context, state) => _transitionPage(state, const AboutScreen()),
          ),
        ],
      ),
    ],
  );
});
