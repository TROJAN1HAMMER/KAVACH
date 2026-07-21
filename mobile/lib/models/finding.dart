import 'package:freezed_annotation/freezed_annotation.dart';

part 'finding.freezed.dart';
part 'finding.g.dart';

/// Mirrors `backend/app/schemas/finding.py::ComplianceMappingSchema`.
@freezed
class ComplianceMapping with _$ComplianceMapping {
  const factory ComplianceMapping({
    String? rbiClause,
    String? pciClause,
    String? swiftClause,
  }) = _ComplianceMapping;

  factory ComplianceMapping.fromJson(Map<String, dynamic> json) =>
      _$ComplianceMappingFromJson(json);
}

/// Mirrors `backend/app/schemas/finding.py::FindingResponse` field-for-field
/// — this is the backend's unified/aggregated finding view (see
/// `backend/app/services/aggregation/unified_finding.py`), returned by
/// `GET /scan/{scanJobId}/findings`. One field on the underlying model,
/// `module`, is not exposed on this response schema and so is intentionally
/// absent here too.
@freezed
class Finding with _$Finding {
  const factory Finding({
    required String id,
    required String scanJobId,
    required String title,
    required String severity, // CRITICAL|HIGH|MEDIUM|LOW|INFO
    required String category,
    required String source,
    required double cvss,
    required double brs,
    String? brsRiskLevel,
    String? filePath,
    int? lineNumber,
    required String description,
    String? package,
    String? packageVersion,
    String? cve,
    String? aiExplanation,
    String? aiBusinessImpact,
    String? aiRemediation,
    ComplianceMapping? compliance,
    List<String>? sources,
    @Default(1) int occurrenceCount,
    String? cweId,
    String? cweName,
    String? owaspCategory,
    String? owaspName,
    List<String>? mitreTechniqueIds,
  }) = _Finding;

  factory Finding.fromJson(Map<String, dynamic> json) =>
      _$FindingFromJson(json);
}

/// Mirrors `FindingsListResponse`.
@freezed
class FindingList with _$FindingList {
  const factory FindingList({
    required String scanJobId,
    required int total,
    required List<Finding> findings,
  }) = _FindingList;

  factory FindingList.fromJson(Map<String, dynamic> json) =>
      _$FindingListFromJson(json);
}
