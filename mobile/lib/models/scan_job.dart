import 'package:freezed_annotation/freezed_annotation.dart';

part 'scan_job.freezed.dart';
part 'scan_job.g.dart';

/// Mirrors `backend/app/schemas/scan_job.py::ScannerStatus` — one entry per
/// scanner engine, keyed by scanner name in `ScanJob.workerStatus`.
@freezed
class ScannerStatus with _$ScannerStatus {
  const factory ScannerStatus({
    required String status,
    required double updatedAt,
    String? taskId,
    String? error,
    int? findingsCount,
  }) = _ScannerStatus;

  factory ScannerStatus.fromJson(Map<String, dynamic> json) =>
      _$ScannerStatusFromJson(json);
}

/// Mirrors `backend/app/schemas/scan_job.py::ScanJobStatusResponse`
/// field-for-field. Returned by `GET /scan/{id}`, embedded in
/// `ScanJobListResponse`, and streamed (as a bare object with no `type`
/// field) over the scan progress WebSocket on connect and just before close.
///
/// `summary` is intentionally left as a raw `Map<String, dynamic>` — the
/// backend's shape there is heterogeneous (severity counts, `by_category`,
/// `by_source`, a nested `scanner_status` dict, and an `aggregation` object)
/// and not worth flattening into a rigid model until a screen actually needs
/// specific keys out of it.
@freezed
class ScanJob with _$ScanJob {
  const factory ScanJob({
    required String scanJobId,
    required String repositoryId,
    required String repositoryName,
    required String status, // queued|running|completed|failed|cancelled
    required String priority, // low|normal|high|critical
    required int progressPercent,
    String? currentStage,
    required int retryCount,
    required int maxRetries,
    required int timeoutSeconds,
    DateTime? queuedAt,
    DateTime? startedAt,
    DateTime? finishedAt,
    DateTime? lastHeartbeatAt,
    DateTime? archivedAt,
    String? errorMessage,
    int? totalFindings,
    double? brsScore,
    String? brsRiskLevel,
    double? attackSurfaceExposureScore,
    String? attackSurfaceExposureLevel,
    Map<String, dynamic>? summary,
    @Default(<String, ScannerStatus>{}) Map<String, ScannerStatus> workerStatus,
  }) = _ScanJob;

  factory ScanJob.fromJson(Map<String, dynamic> json) =>
      _$ScanJobFromJson(json);
}

/// Mirrors `ScanJobListResponse`. Returned by `GET /scan`.
@freezed
class ScanJobList with _$ScanJobList {
  const factory ScanJobList({
    required int total,
    required List<ScanJob> scanJobs,
  }) = _ScanJobList;

  factory ScanJobList.fromJson(Map<String, dynamic> json) =>
      _$ScanJobListFromJson(json);
}

/// Mirrors `ScanJobCreateResponse`. Returned by `POST /scan`,
/// `POST /scan/repository`, and `POST /scan/premade/{risk_level}`.
@freezed
class ScanJobCreateResult with _$ScanJobCreateResult {
  const factory ScanJobCreateResult({
    required String scanJobId,
    required String repositoryId,
    required String status,
    required String priority,
    required String message,
  }) = _ScanJobCreateResult;

  factory ScanJobCreateResult.fromJson(Map<String, dynamic> json) =>
      _$ScanJobCreateResultFromJson(json);
}
