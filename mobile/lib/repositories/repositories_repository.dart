import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/repository.dart';
import '../services/repository_service.dart';

/// Domain layer over `/repositories*`. Named `RepositoriesRepository` (not
/// `RepositoryRepository`) to keep "the `Repository` model" and "the
/// repository-pattern class" unambiguous in call sites.
class RepositoriesRepository {
  RepositoriesRepository(this._service);

  final RepositoryService _service;

  Future<List<Repository>> list() async {
    try {
      return await _service.list();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<Repository> setScheduledScan({
    required String repositoryId,
    required bool enabled,
  }) async {
    try {
      return await _service.setScheduledScan(
        repositoryId: repositoryId,
        enabled: enabled,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
