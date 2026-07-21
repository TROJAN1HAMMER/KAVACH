import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/rbac/route_keys.dart';
import '../core/rbac/rbac.dart';
import '../core/rbac/user_role.dart';
import '../models/user.dart';
import 'core_providers.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.isBusy = false,
    this.error,
  });

  final AuthStatus status;
  final User? user;
  final bool isBusy;
  final String? error;

  bool get isAuthenticated => status == AuthStatus.authenticated && user != null;

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    bool clearUser = false,
    bool? isBusy,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      isBusy: isBusy ?? this.isBusy,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Owns the single source of truth for "who is logged in right now" and
/// drives [GoRouter]'s redirect logic (see `core/router/app_router.dart`).
/// Screens should read [authProvider] for `user`/`isAuthenticated`, and use
/// `ref.read(authProvider.notifier)` to call [login]/[signup]/[logout].
class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    return const AuthState();
  }

  Future<void> restoreSession() async {
    state = state.copyWith(isBusy: true);
    final user = await ref.read(authRepositoryProvider).tryRestoreSession();
    state = user != null
        ? state.copyWith(status: AuthStatus.authenticated, user: user, isBusy: false)
        : state.copyWith(status: AuthStatus.unauthenticated, isBusy: false);
  }

  Future<bool> login({required String email, required String password}) async {
    state = state.copyWith(isBusy: true, clearError: true);
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .login(email: email, password: password);
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
        isBusy: false,
      );
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isBusy: false, error: e.message);
      return false;
    }
  }

  Future<bool> signup({
    required String email,
    required String password,
    String? fullName,
  }) async {
    state = state.copyWith(isBusy: true, clearError: true);
    try {
      await ref.read(authRepositoryProvider).register(
            email: email,
            password: password,
            fullName: fullName,
          );
      // Registration issues no tokens (see backend/app/auth/router.py) — log
      // the freshly created account in immediately for a smooth signup flow.
      return login(email: email, password: password);
    } on ApiException catch (e) {
      state = state.copyWith(isBusy: false, error: e.message);
      return false;
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Called by [ApiClient]'s `onSessionExpired` hook when a refresh attempt
  /// fails — does not call the (nonexistent) backend logout, just drops
  /// local state so the router redirects to `/login`.
  Future<void> forceLogout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

final currentUserRoleProvider = Provider<UserRole?>((ref) {
  return ref.watch(authProvider).user?.role;
});

/// Route-level UX gate — see the caveat in `core/rbac/rbac.dart`: this hides
/// nav items / redirects, it is not the security boundary.
final routeAccessProvider = Provider.family<bool, RouteKey>((ref, routeKey) {
  return canAccessRoute(ref.watch(currentUserRoleProvider), routeKey);
});

/// Fine-grained, backend-driven capability check — prefer this over
/// [routeAccessProvider] for gating an action within a screen (e.g. "show
/// the Start Scan button"), since it reads the server-computed
/// `User.permissions` rather than a client-side role table.
bool hasPermission(WidgetRef ref, String permission) {
  final user = ref.watch(authProvider).user;
  return user?.permissions.contains(permission) ?? false;
}
