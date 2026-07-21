import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import 'nav_items.dart';

/// Persistent authenticated-area chrome: a [Drawer] listing every
/// role-accessible screen (desktop/tablet-width also shows a permanent side
/// rail) plus a bottom nav bar with the four most-used destinations on
/// narrow (phone) widths. Wraps every route inside the app's `ShellRoute` —
/// see `core/router/app_router.dart`.
class MainShell extends ConsumerWidget {
  const MainShell({required this.currentPath, required this.child, super.key});

  final String currentPath;
  final Widget child;

  static const double _wideBreakpoint = 720;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentUserRoleProvider);
    final visibleItems = kNavItems
        .where((item) => ref.watch(routeAccessProvider(item.routeKey)))
        .toList();

    final bool isWide = MediaQuery.sizeOf(context).width >= _wideBreakpoint;

    final visibleBottomItems = visibleItems
        .where((item) => kBottomNavRouteKeys.contains(item.routeKey))
        .toList();
    final int bottomIndex = visibleBottomItems.indexWhere(
      (item) => item.path == currentPath,
    );

    final drawer = _NavDrawer(
      items: visibleItems,
      currentPath: currentPath,
      roleLabel: role?.wireValue,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('KAVACH'),
        leading: isWide
            ? null
            : Builder(
                builder: (context) => IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
              ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Profile',
            onPressed: () => context.go(RoutePaths.profile),
          ),
        ],
      ),
      drawer: isWide ? null : drawer,
      body: Row(
        children: [
          if (isWide) SizedBox(width: 260, child: drawer),
          if (isWide) const VerticalDivider(width: 1, color: AppColors.border),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: isWide || visibleBottomItems.isEmpty
          ? null
          : BottomNavigationBar(
              currentIndex: bottomIndex < 0 ? 0 : bottomIndex,
              onTap: (index) => context.go(visibleBottomItems[index].path),
              items: [
                for (final item in visibleBottomItems)
                  BottomNavigationBarItem(
                    icon: Icon(item.icon),
                    label: item.label,
                  ),
              ],
            ),
    );
  }
}

class _NavDrawer extends ConsumerWidget {
  const _NavDrawer({
    required this.items,
    required this.currentPath,
    required this.roleLabel,
  });

  final List<NavItem> items;
  final String currentPath;
  final String? roleLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    return Drawer(
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.shield, color: AppColors.primary),
                      SizedBox(width: 8),
                      Text(
                        'KAVACH',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.foreground,
                        ),
                      ),
                    ],
                  ),
                  if (user != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      user.fullName ?? user.email,
                      style: const TextStyle(
                        color: AppColors.foreground,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      user.roleDisplayName,
                      style: const TextStyle(
                        color: AppColors.mutedForeground,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  for (final item in items)
                    _DrawerTile(
                      item: item,
                      selected: item.path == currentPath,
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.danger),
              title: const Text(
                'Log out',
                style: TextStyle(color: AppColors.danger),
              ),
              onTap: () => ref.read(authProvider.notifier).logout(),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({required this.item, required this.selected});

  final NavItem item;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(
        item.icon,
        color: selected ? AppColors.primary : AppColors.mutedForeground,
      ),
      title: Text(
        item.label,
        style: TextStyle(
          color: selected ? AppColors.primary : AppColors.foreground,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
        ),
      ),
      selected: selected,
      selectedTileColor: AppColors.accent,
      shape: const RoundedRectangleBorder(),
      onTap: () {
        if (Scaffold.of(context).hasDrawer) {
          Navigator.of(context).maybePop();
        }
        context.go(item.path);
      },
    );
  }
}
