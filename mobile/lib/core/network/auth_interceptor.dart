import 'dart:async';

import 'package:dio/dio.dart';

import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

/// Attaches `Authorization: Bearer <token>` to every request, and on a 401
/// tries exactly once to refresh via `POST /auth/refresh` before replaying
/// the original request. If refresh also fails, [onSessionExpired] fires so
/// the app can drop back to the login screen.
///
/// Only one refresh is ever in flight at a time — concurrent 401s all await
/// the same [Future] instead of hammering `/auth/refresh`.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required Dio refreshDio,
    required SecureStorageService storage,
    required this.onSessionExpired,
  })  : _refreshDio = refreshDio,
        _storage = storage;

  final Dio _refreshDio;
  final SecureStorageService _storage;
  final Future<void> Function() onSessionExpired;

  Future<String?>? _refreshInFlight;

  static const List<String> _publicPaths = <String>[
    ApiConstants.login,
    ApiConstants.register,
    ApiConstants.refresh,
  ];

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!_publicPaths.any(options.path.contains)) {
      final String? token = await _storage.readAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final bool isAuthCall = _publicPaths.any(err.requestOptions.path.contains);
    if (err.response?.statusCode != 401 || isAuthCall) {
      handler.next(err);
      return;
    }

    final String? newAccessToken = await _refreshAccessToken();
    if (newAccessToken == null) {
      await onSessionExpired();
      handler.next(err);
      return;
    }

    try {
      final RequestOptions retryRequest = err.requestOptions;
      retryRequest.headers['Authorization'] = 'Bearer $newAccessToken';
      final Response<dynamic> response = await _refreshDio.fetch(retryRequest);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<String?> _refreshAccessToken() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<String?> _doRefresh() async {
    final String? refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null) {
      return null;
    }
    try {
      final Response<dynamic> response = await _refreshDio.post<dynamic>(
        ApiConstants.refresh,
        data: <String, String>{'refresh_token': refreshToken},
      );
      final Map<String, dynamic> data = response.data as Map<String, dynamic>;
      final String accessToken = data['access_token'] as String;
      await _storage.updateAccessToken(accessToken);
      return accessToken;
    } on DioException {
      return null;
    }
  }
}
