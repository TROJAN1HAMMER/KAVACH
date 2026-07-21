import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/repository.dart';

/// Raw HTTP calls for `/repositories*`. There is no create/delete/single-get
/// endpoint on the backend — only list and the scheduled-scan toggle. See
/// `RepositoryResponse` in the backend-gaps notes.
class RepositoryService {
  RepositoryService(this._dio);

  final Dio _dio;

  Future<List<Repository>> list({int limit = 50, int offset = 0}) async {
    final Response<dynamic> response = await _dio.get<dynamic>(
      ApiConstants.repositories,
      queryParameters: <String, dynamic>{'limit': limit, 'offset': offset},
    );
    final List<dynamic> raw = response.data as List<dynamic>;
    return raw
        .map((dynamic item) => Repository.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Repository> setScheduledScan({
    required String repositoryId,
    required bool enabled,
  }) async {
    final Response<dynamic> response = await _dio.patch<dynamic>(
      ApiConstants.repositoryScheduledScan(repositoryId),
      data: <String, bool>{'enabled': enabled},
    );
    return Repository.fromJson(response.data as Map<String, dynamic>);
  }
}
