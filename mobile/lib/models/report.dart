import 'package:freezed_annotation/freezed_annotation.dart';

part 'report.freezed.dart';
part 'report.g.dart';

/// Mirrors `backend/app/schemas/report.py::ReportStatusDetail`.
@freezed
class ReportStatusDetail with _$ReportStatusDetail {
  const factory ReportStatusDetail({
    required String reportType,
    required String status, // pending | generating | completed | failed
    String? errorMessage,
  }) = _ReportStatusDetail;

  factory ReportStatusDetail.fromJson(Map<String, dynamic> json) =>
      _$ReportStatusDetailFromJson(json);
}

/// Mirrors `ReportPathsResponse`. Returned by `GET /reports/{scanJobId}`.
/// Each `*Available` flag gates whether
/// `GET /reports/{scanJobId}/download/{reportType}` will succeed for that
/// report type.
@freezed
class ReportPaths with _$ReportPaths {
  const factory ReportPaths({
    required String scanJobId,
    required bool pdfAvailable,
    required bool pdfTechnicalAvailable,
    required bool sarifAvailable,
    required bool sbomAvailable,
    required bool unifiedFindingsAvailable,
    required bool complianceReportAvailable,
    required bool csvAvailable,
    @Default(<ReportStatusDetail>[]) List<ReportStatusDetail> reports,
  }) = _ReportPaths;

  factory ReportPaths.fromJson(Map<String, dynamic> json) =>
      _$ReportPathsFromJson(json);
}

/// The seven `report_type` path-param values the backend accepts on
/// `GET /reports/{scanJobId}/download/{reportType}` — kept as plain string
/// constants (not an enum) since they're used directly as URL path segments.
class ReportType {
  const ReportType._();

  static const String pdf = 'pdf';
  static const String pdfTechnical = 'pdf_technical';
  static const String sarif = 'sarif';
  static const String sbom = 'sbom';
  static const String csv = 'csv';
  static const String unifiedFindings = 'unified_findings';
  static const String complianceReport = 'compliance_report';
}
