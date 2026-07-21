import 'route_keys.dart';
import 'user_role.dart';

/// Direct port of `frontend/src/lib/rbac.ts`'s `ROUTE_ROLES` table, so the
/// mobile app's nav/redirect behavior never disagrees with the web app's for
/// the same backend account. `reports`, `notifications`, `profile`,
/// `settings`, and `about` have no equivalent gated entry on the web (they're
/// either ungated there or don't exist yet) — reports/notifications are kept
/// open to every authenticated role since every role holds `report:read`
/// per the backend's `ROLE_PERMISSIONS`; profile/settings/about are
/// account-level, not data-access, screens, so every authenticated role can
/// reach them.
const Map<RouteKey, List<UserRole>> kRouteRoles = <RouteKey, List<UserRole>>{
  RouteKey.dashboard: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.developer,
  ],
  RouteKey.repositories: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.developer,
  ],
  RouteKey.scans: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.developer,
  ],
  RouteKey.risk: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.developer,
    UserRole.auditor,
    UserRole.readOnly,
  ],
  RouteKey.compliance: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.developer,
    UserRole.auditor,
    UserRole.readOnly,
  ],
  RouteKey.findings: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.developer,
  ],
  RouteKey.executive: <UserRole>[
    UserRole.admin,
    UserRole.securityEngineer,
    UserRole.auditor,
    UserRole.readOnly,
  ],
  RouteKey.architecture: UserRole.values,
  RouteKey.reports: UserRole.values,
  RouteKey.notifications: UserRole.values,
  RouteKey.profile: UserRole.values,
  RouteKey.settings: UserRole.values,
  RouteKey.about: UserRole.values,
};

/// Mirrors `DEFAULT_ROUTE_FOR_ROLE` in `frontend/src/lib/rbac.ts`.
const Map<UserRole, String> kDefaultRouteForRole = <UserRole, String>{
  UserRole.admin: '/repositories',
  UserRole.securityEngineer: '/repositories',
  UserRole.developer: '/repositories',
  UserRole.auditor: '/executive',
  UserRole.readOnly: '/executive',
};

bool canAccessRoute(UserRole? role, RouteKey routeKey) {
  if (role == null) {
    return false;
  }
  return kRouteRoles[routeKey]?.contains(role) ?? false;
}

String defaultRouteForRole(UserRole? role) {
  if (role == null) {
    return '/login';
  }
  return kDefaultRouteForRole[role] ?? '/dashboard';
}
