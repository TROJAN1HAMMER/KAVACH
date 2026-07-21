import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import 'nav_items.dart';

/// Persistent authenticated-area chrome: a [Drawer] listing every
/// role-accessible screen (desktop/tablet-width also shows a permanent side
/// rail) plus a bottom nav bar with the four most-used destinations on
/// narrow (phone) widths. Wraps every route inside the app's `ShellRoute` —
/// see `core/router/app_router.dart`.
class MainShell extends ConsumerStatefulWidget {
  const MainShell({required this.currentPath, required this.child, super.key});

  final String currentPath;
  final Widget child;

  static const double _wideBreakpoint = 720;

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  bool _elevated = false;

  void _handleScrollNotification(ScrollNotification notification) {
    final bool shouldElevate = notification.metrics.pixels > 4;
    if (shouldElevate != _elevated) {
      setState(() => _elevated = shouldElevate);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(currentUserRoleProvider);
    final visibleItems = kNavItems
        .where((item) => ref.watch(routeAccessProvider(item.routeKey)))
        .toList();

    final bool isWide = MediaQuery.sizeOf(context).width >= MainShell._wideBreakpoint;

    final visibleBottomItems = visibleItems
        .where((item) => kBottomNavRouteKeys.contains(item.routeKey))
        .toList();
    final int bottomIndex = visibleBottomItems.indexWhere(
      (item) => item.path == widget.currentPath,
    );

    final drawer = _NavDrawer(
      items: visibleItems,
      currentPath: widget.currentPath,
      roleLabel: role?.wireValue,
    );

    return Scaffold(
      appBar: _ElevatedAppBar(
        elevated: _elevated,
        appBar: AppBar(
          title: const Text('KAVACH'),
          leading: isWide
              ? null
              : Builder(
                  builder: (context) => IconButton(
                    icon: const Icon(Icons.menu),
                    tooltip: 'Open navigation',
                    onPressed: () {
                      HapticFeedback.selectionClick();
                      Scaffold.of(context).openDrawer();
                    },
                  ),
                ),
          actions: [
            IconButton(
              icon: const Icon(Icons.person_outline),
              tooltip: 'Profile',
              onPressed: () {
                HapticFeedback.selectionClick();
                context.go(RoutePaths.profile);
              },
            ),
          ],
        ),
      ),
      drawer: isWide ? null : drawer,
      body: Row(
        children: [
          if (isWide) SizedBox(width: 260, child: drawer),
          if (isWide) const VerticalDivider(width: 1, color: AppColors.border),
          Expanded(
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                _handleScrollNotification(notification);
                return false;
              },
              child: widget.child,
            ),
          ),
        ],
      ),
      bottomNavigationBar: isWide || visibleBottomItems.isEmpty
          ? null
          : BottomNavigationBar(
              currentIndex: bottomIndex < 0 ? 0 : bottomIndex,
              onTap: (index) {
                HapticFeedback.selectionClick();
                context.go(visibleBottomItems[index].path);
              },
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

/// Adds a subtle drop shadow once the body scrolls past the top — a small
/// depth cue distinguishing "content behind the bar" from "content flush
/// with it," instead of the flat `elevation: 0` bar staying identical
/// regardless of scroll position.
class _ElevatedAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _ElevatedAppBar({required this.elevated, required this.appBar});

  final bool elevated;
  final AppBar appBar;

  @override
  Size get preferredSize => appBar.preferredSize;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppMotion.fast,
      decoration: BoxDecoration(
        boxShadow: elevated
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : const [],
      ),
      child: appBar,
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
            Container(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.accent, AppColors.card],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                        ),
                        child: const Icon(Icons.shield, color: AppColors.primary, size: 18),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'KAVACH',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ],
                  ),
                  if (user != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      user.fullName ?? user.email,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      user.roleDisplayName,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
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
              onTap: () {
                HapticFeedback.mediumImpact();
                ref.read(authProvider.notifier).logout();
              },
            ),
            const SizedBox(height: AppSpacing.sm),
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
      child: AnimatedContainer(
        duration: AppMotion.fast,
        curve: AppMotion.switchCurve,
        decoration: BoxDecoration(
          color: selected ? AppColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: ListTile(
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
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
          onTap: () {
            HapticFeedback.selectionClick();
            if (Scaffold.of(context).hasDrawer) {
              Navigator.of(context).maybePop();
            }
            context.go(item.path);
          },
        ),
      ),
    );
  }
}
