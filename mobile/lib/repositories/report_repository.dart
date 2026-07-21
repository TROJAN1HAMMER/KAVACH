import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/report.dart';
import '../services/report_service.dart';

/// Domain layer over `/reports/*`.
class ReportRepository {
  ReportRepository(this._service);

  final ReportService _service;

  Future<ReportPaths> paths(String scanJobId) async {
    try {
      return await _service.paths(scanJobId);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> download({
    required String scanJobId,
    required String reportType,
    required String savePath,
    void Function(int received, int total)? onProgress,
  }) async {
    try {
      await _service.download(
        scanJobId: scanJobId,
        reportType: reportType,
        savePath: savePath,
        onProgress: onProgress,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
