import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';
import 'auth_interceptor.dart';

/// Single Dio instance for the whole app. Repositories depend on this, never
/// on `Dio()` directly, so every request gets the same base URL, timeouts,
/// auth handling, and (debug-only) logging.
class ApiClient {
  ApiClient({
    required SecureStorageService storage,
    required Future<void> Function() onSessionExpired,
  }) : dio = Dio(
          BaseOptions(
            baseUrl: ApiConstants.baseUrl,
            connectTimeout: ApiConstants.connectTimeout,
            receiveTimeout: ApiConstants.receiveTimeout,
            sendTimeout: ApiConstants.sendTimeout,
            headers: <String, String>{'Accept': 'application/json'},
          ),
        ) {
    // A bare Dio (no auth header injection) is used only for the token
    // refresh call itself, to avoid the interceptor recursively trying to
    // refresh a refresh request.
    final Dio refreshDio = Dio(dio.options);

    dio.interceptors.addAll(<Interceptor>[
      AuthInterceptor(
        refreshDio: refreshDio,
        storage: storage,
        onSessionExpired: onSessionExpired,
      ),
      if (kDebugMode)
        LogInterceptor(
          requestHeader: false,
          responseHeader: false,
          requestBody: true,
          responseBody: true,
          error: true,
          logPrint: (Object object) => debugPrint('[dio] $object'),
        ),
    ]);
  }

  final Dio dio;
}
