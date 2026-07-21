import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/compliance.dart';
import '../models/finding.dart';
import '../models/scan_job.dart';

/// Raw HTTP calls for `/scan*`. Covers submission (zip upload / repo URL /
/// premade fixtures), polling, cancellation, findings, and compliance.
///
/// The live progress WebSocket (`/scan/{id}/ws?token=...`) and the
/// server-sent-events explain-stream
/// (`/scan/{id}/findings/{findingId}/explain/stream`) are documented in
/// `ApiConstants` but intentionally not wrapped here yet — they need a
/// streaming-aware provider, which is next-milestone work (see the report).
class ScanService {
  ScanService(this._dio);

  final Dio _dio;

  Future<ScanJobCreateResult> uploadZip({
    required String filePath,
    required String fileName,
    String priority = 'normal',
    int maxRetries = 2,
    int timeoutSeconds = 900,
  }) async {
    final FormData formData = FormData.fromMap(<String, dynamic>{
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
      'priority': priority,
      'max_retries': maxRetries,
      'timeout_seconds': timeoutSeconds,
    });
    final Response<dynamic> response = await _dio.post<dynamic>(
      ApiConstants.scanUpload,
      data: formData,
    );
    return ScanJobCreateResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ScanJobCreateResult> submitRepositoryUrl({
    required String repoUrl,
    String? ref,
    String priority = 'normal',
    int maxRetries = 2,
    int timeoutSeconds = 900,
  }) async {
    final Response<dynamic> response = await _dio.post<dynamic>(
      ApiConstants.scanFromRepoUrl,
      data: <String, dynamic>{
        'repo_url': repoUrl,
        if (ref != null) 'ref': ref,
        'priority': priority,
        'max_retries': maxRetries,
        'timeout_seconds': timeoutSeconds,
      },
    );
    return ScanJobCreateResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ScanJobCreateResult> submitPremade(String riskLevel) async {
    final Response<dynamic> response =
        await _dio.post<dynamic>(ApiConstants.scanPremade(riskLevel));
    return ScanJobCreateResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ScanJobList> list({String? status, int limit = 50, int offset = 0}) async {
    final Response<dynamic> response = await _dio.get<dynamic>(
      ApiConstants.scanList,
      queryParameters: <String, dynamic>{
        if (status != null) 'status': status,
        'limit': limit,
        'offset': offset,
      },
    );
    return ScanJobList.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ScanJob> detail(String scanJobId) async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.scanDetail(scanJobId));
    return ScanJob.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ScanJob> cancel(String scanJobId) async {
    final Response<dynamic> response =
        await _dio.post<dynamic>(ApiConstants.scanCancel(scanJobId));
    return ScanJob.fromJson(response.data as Map<String, dynamic>);
  }

  Future<FindingList> findings(String scanJobId) async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.scanFindings(scanJobId));
    return FindingList.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ComplianceEngineResult> compliance(String scanJobId) async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.scanCompliance(scanJobId));
    return ComplianceEngineResult.fromJson(response.data as Map<String, dynamic>);
  }
}
