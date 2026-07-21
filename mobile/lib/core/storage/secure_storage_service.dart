import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

/// Thin wrapper around `flutter_secure_storage` so nothing else in the app
/// imports the package directly — swapping the persistence mechanism later
/// only touches this file.
class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(
      key: AppConstants.secureStorageAccessTokenKey,
      value: accessToken,
    );
    await _storage.write(
      key: AppConstants.secureStorageRefreshTokenKey,
      value: refreshToken,
    );
  }

  Future<String?> readAccessToken() {
    return _storage.read(key: AppConstants.secureStorageAccessTokenKey);
  }

  Future<String?> readRefreshToken() {
    return _storage.read(key: AppConstants.secureStorageRefreshTokenKey);
  }

  Future<void> updateAccessToken(String accessToken) {
    return _storage.write(
      key: AppConstants.secureStorageAccessTokenKey,
      value: accessToken,
    );
  }

  Future<void> clear() async {
    await _storage.delete(key: AppConstants.secureStorageAccessTokenKey);
    await _storage.delete(key: AppConstants.secureStorageRefreshTokenKey);
  }
}
