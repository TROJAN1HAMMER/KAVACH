import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/storage/secure_storage_service.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

/// Owns the login/signup/session lifecycle: calls [AuthService], persists
/// tokens via [SecureStorageService], and normalizes failures into
/// [ApiException] so [AuthNotifier] never has to know Dio exists.
class AuthRepository {
  AuthRepository({
    required AuthService authService,
    required SecureStorageService storage,
  })  : _authService = authService,
        _storage = storage;

  final AuthService _authService;
  final SecureStorageService _storage;

  Future<User> register({
    required String email,
    required String password,
    String? fullName,
  }) async {
    try {
      return await _authService.register(
        email: email,
        password: password,
        fullName: fullName,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<User> login({required String email, required String password}) async {
    try {
      final tokens = await _authService.login(email: email, password: password);
      await _storage.saveTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
      return await _authService.me();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  /// Restores a session from a previously persisted access token, if any.
  /// Returns `null` (rather than throwing) when there's no token or it's no
  /// longer valid — callers treat that as "show the landing screen".
  Future<User?> tryRestoreSession() async {
    final String? token = await _storage.readAccessToken();
    if (token == null) {
      return null;
    }
    try {
      return await _authService.me();
    } on DioException {
      await _storage.clear();
      return null;
    }
  }

  /// The backend has no logout/token-revocation endpoint — refresh tokens
  /// are stateless JWTs that simply expire (see the milestone report's
  /// backend-gaps list). Logging out is local-only: discard both tokens.
  Future<void> logout() async {
    await _storage.clear();
  }
}
