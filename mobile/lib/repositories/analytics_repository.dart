import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/analytics.dart';
import '../services/analytics_service.dart';

/// Domain layer over `/analytics/*`.
class AnalyticsRepository {
  AnalyticsRepository(this._service);

  final AnalyticsService _service;

  Future<MyActivitySummary> myActivity() async {
    try {
      return await _service.myActivity();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<TeamActivitySummary> teamActivity() async {
    try {
      return await _service.teamActivity();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
