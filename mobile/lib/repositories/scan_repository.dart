import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/scan_job.dart';
import '../services/scan_service.dart';

/// Domain layer over `/scan*` (submission, polling, cancellation).
/// Findings/compliance retrieval live in [FindingRepository] and
/// [ComplianceRepository] respectively, even though both call back into
/// [ScanService] under the hood — the backend nests those under the scan
/// job's URL, but they're a different concern for the UI layer.
class ScanRepository {
  ScanRepository(this._service);

  final ScanService _service;

  Future<ScanJobCreateResult> uploadZip({
    required String filePath,
    required String fileName,
    String priority = 'normal',
  }) async {
    try {
      return await _service.uploadZip(
        filePath: filePath,
        fileName: fileName,
        priority: priority,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ScanJobCreateResult> submitRepositoryUrl({
    required String repoUrl,
    String? ref,
    String priority = 'normal',
  }) async {
    try {
      return await _service.submitRepositoryUrl(
        repoUrl: repoUrl,
        ref: ref,
        priority: priority,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ScanJobCreateResult> submitPremade(String riskLevel) async {
    try {
      return await _service.submitPremade(riskLevel);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ScanJobList> list({String? status}) async {
    try {
      return await _service.list(status: status);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ScanJob> detail(String scanJobId) async {
    try {
      return await _service.detail(scanJobId);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ScanJob> cancel(String scanJobId) async {
    try {
      return await _service.cancel(scanJobId);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
