import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/analytics.dart';

/// Raw HTTP calls for `/analytics/*`.
class AnalyticsService {
  AnalyticsService(this._dio);

  final Dio _dio;

  Future<MyActivitySummary> myActivity() async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.myActivity);
    return MyActivitySummary.fromJson(response.data as Map<String, dynamic>);
  }

  /// Requires `team_analytics:read` (admin, security_engineer only) — callers
  /// should gate the UI with `Permission.teamAnalyticsRead` before calling.
  Future<TeamActivitySummary> teamActivity() async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.teamActivity);
    return TeamActivitySummary.fromJson(response.data as Map<String, dynamic>);
  }
}
