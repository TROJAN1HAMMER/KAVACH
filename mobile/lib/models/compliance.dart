import 'package:freezed_annotation/freezed_annotation.dart';

part 'compliance.freezed.dart';
part 'compliance.g.dart';

/// Mirrors `backend/app/schemas/compliance.py::ComplianceEvidenceSchema`.
@freezed
class ComplianceEvidence with _$ComplianceEvidence {
  const factory ComplianceEvidence({
    required String findingTitle,
    required String severity,
    String? filePath,
    int? lineNumber,
    required String source,
  }) = _ComplianceEvidence;

  factory ComplianceEvidence.fromJson(Map<String, dynamic> json) =>
      _$ComplianceEvidenceFromJson(json);
}

/// Mirrors `ComplianceControlResultSchema`.
@freezed
class ComplianceControlResult with _$ComplianceControlResult {
  const factory ComplianceControlResult({
    required String requirementId,
    required String title,
    required String description,
    required String status, // "PASS" | "FAIL"
    required List<ComplianceEvidence> evidence,
    required String recommendation,
  }) = _ComplianceControlResult;

  factory ComplianceControlResult.fromJson(Map<String, dynamic> json) =>
      _$ComplianceControlResultFromJson(json);
}

/// Mirrors `FrameworkComplianceReportSchema`. One per framework (PCI DSS
/// v4.0, RBI IT Framework, SWIFT CSP — exact identifiers come from the
/// backend's YAML rule catalog at runtime via `shortCode`/`version`).
@freezed
class FrameworkComplianceReport with _$FrameworkComplianceReport {
  const factory FrameworkComplianceReport({
    required String frameworkName,
    required String shortCode,
    required String version,
    required List<ComplianceControlResult> controls,
    required int totalControls,
    required int passedControls,
    required int failedControls,
    required double compliancePercentage,
  }) = _FrameworkComplianceReport;

  factory FrameworkComplianceReport.fromJson(Map<String, dynamic> json) =>
      _$FrameworkComplianceReportFromJson(json);
}

/// Mirrors `ComplianceEngineResultSchema`. Returned by
/// `GET /scan/{scanJobId}/compliance`.
@freezed
class ComplianceEngineResult with _$ComplianceEngineResult {
  const factory ComplianceEngineResult({
    String? scanJobId,
    required List<FrameworkComplianceReport> frameworks,
    required double overallCompliancePercentage,
  }) = _ComplianceEngineResult;

  factory ComplianceEngineResult.fromJson(Map<String, dynamic> json) =>
      _$ComplianceEngineResultFromJson(json);
}
