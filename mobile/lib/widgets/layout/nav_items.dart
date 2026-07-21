import 'package:flutter/material.dart';

import '../../core/rbac/route_keys.dart';
import '../../core/router/route_paths.dart';

class NavItem {
  const NavItem({
    required this.routeKey,
    required this.path,
    required this.label,
    required this.icon,
  });

  final RouteKey routeKey;
  final String path;
  final String label;
  final IconData icon;
}

/// One entry per authenticated destination. Mirrors
/// `frontend/src/components/layout/Sidebar.tsx`'s `NAV_ITEMS`, filtered the
/// same way (`routeAccessProvider`) so the drawer never shows a role a link
/// it can't use.
const List<NavItem> kNavItems = <NavItem>[
  NavItem(
    routeKey: RouteKey.dashboard,
    path: RoutePaths.dashboard,
    label: 'Dashboard',
    icon: Icons.home_outlined,
  ),
  NavItem(
    routeKey: RouteKey.repositories,
    path: RoutePaths.repositories,
    label: 'Repositories',
    icon: Icons.storage_outlined,
  ),
  NavItem(
    routeKey: RouteKey.scans,
    path: RoutePaths.scanQueue,
    label: 'Scan Queue',
    icon: Icons.checklist_outlined,
  ),
  NavItem(
    routeKey: RouteKey.risk,
    path: RoutePaths.risk,
    label: 'Risk Dashboard',
    icon: Icons.shield_outlined,
  ),
  NavItem(
    routeKey: RouteKey.compliance,
    path: RoutePaths.compliance,
    label: 'Compliance',
    icon: Icons.rule_outlined,
  ),
  NavItem(
    routeKey: RouteKey.findings,
    path: RoutePaths.findings,
    label: 'Finding Explorer',
    icon: Icons.search_outlined,
  ),
  NavItem(
    routeKey: RouteKey.executive,
    path: RoutePaths.executive,
    label: 'Executive Summary',
    icon: Icons.bar_chart_outlined,
  ),
  NavItem(
    routeKey: RouteKey.reports,
    path: RoutePaths.reports,
    label: 'Reports',
    icon: Icons.description_outlined,
  ),
  NavItem(
    routeKey: RouteKey.architecture,
    path: RoutePaths.architecture,
    label: 'Architecture',
    icon: Icons.hub_outlined,
  ),
  NavItem(
    routeKey: RouteKey.notifications,
    path: RoutePaths.notifications,
    label: 'Notifications',
    icon: Icons.notifications_outlined,
  ),
  NavItem(
    routeKey: RouteKey.settings,
    path: RoutePaths.settings,
    label: 'Settings',
    icon: Icons.settings_outlined,
  ),
  NavItem(
    routeKey: RouteKey.about,
    path: RoutePaths.about,
    label: 'About',
    icon: Icons.info_outline,
  ),
];

/// The subset promoted to the bottom navigation bar on narrow screens — the
/// rest stay reachable via the drawer. Kept to 4 so it never scrolls.
const List<RouteKey> kBottomNavRouteKeys = <RouteKey>[
  RouteKey.dashboard,
  RouteKey.repositories,
  RouteKey.scans,
  RouteKey.risk,
];
