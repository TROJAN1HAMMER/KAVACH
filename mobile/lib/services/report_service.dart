import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/report.dart';

/// Raw HTTP calls for `/reports/*`.
class ReportService {
  ReportService(this._dio);

  final Dio _dio;

  Future<ReportPaths> paths(String scanJobId) async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.reportPaths(scanJobId));
    return ReportPaths.fromJson(response.data as Map<String, dynamic>);
  }

  /// Streams the report file to [savePath]. `reportType` must be one of the
  /// [ReportType] constants. The backend may respond with the file directly
  /// or a 307 redirect to a presigned S3 URL — Dio follows redirects by
  /// default, so callers don't need to handle that themselves.
  Future<void> download({
    required String scanJobId,
    required String reportType,
    required String savePath,
    void Function(int received, int total)? onProgress,
  }) async {
    await _dio.download(
      ApiConstants.reportDownload(scanJobId, reportType),
      savePath,
      onReceiveProgress: onProgress,
    );
  }
}
