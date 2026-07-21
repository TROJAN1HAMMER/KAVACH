import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/token_response.dart';
import '../models/user.dart';

/// Raw HTTP calls for `/auth/*`. Returns parsed models; never touches
/// storage or app state — that's [AuthRepository]'s job.
class AuthService {
  AuthService(this._dio);

  final Dio _dio;

  Future<User> register({
    required String email,
    required String password,
    String? fullName,
  }) async {
    final Response<dynamic> response = await _dio.post<dynamic>(
      ApiConstants.register,
      data: <String, dynamic>{
        'email': email,
        'password': password,
        if (fullName != null && fullName.isNotEmpty) 'full_name': fullName,
      },
    );
    return User.fromJson(response.data as Map<String, dynamic>);
  }

  /// The backend's `/auth/login` is an OAuth2 password-flow endpoint —
  /// form-encoded body with `username`/`password` keys (username = email),
  /// not JSON. See `backend/app/auth/router.py`.
  Future<TokenResponse> login({
    required String email,
    required String password,
  }) async {
    final Response<dynamic> response = await _dio.post<dynamic>(
      ApiConstants.login,
      data: <String, String>{'username': email, 'password': password},
      options: Options(
        contentType: Headers.formUrlEncodedContentType,
      ),
    );
    return TokenResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<TokenResponse> refresh(String refreshToken) async {
    final Response<dynamic> response = await _dio.post<dynamic>(
      ApiConstants.refresh,
      data: <String, String>{'refresh_token': refreshToken},
    );
    return TokenResponse.fromJson(response.data as Map<String, dynamic>);
  }

  Future<User> me() async {
    final Response<dynamic> response = await _dio.get<dynamic>(ApiConstants.me);
    return User.fromJson(response.data as Map<String, dynamic>);
  }
}
