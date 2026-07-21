import 'package:freezed_annotation/freezed_annotation.dart';

part 'finding_intelligence.freezed.dart';
part 'finding_intelligence.g.dart';

/// Mirrors the citation shape returned inside
/// `backend/app/schemas/finding_intelligence.py::FindingIntelligenceResponse`.
@freezed
class FindingIntelligenceCitation with _$FindingIntelligenceCitation {
  const factory FindingIntelligenceCitation({
    required String documentId,
    required String filename,
    int? pageNumber,
    String? sectionPath,
    String? heading,
    required double similarityScore,
    required double rerankScore,
    required String excerpt,
  }) = _FindingIntelligenceCitation;

  factory FindingIntelligenceCitation.fromJson(Map<String, dynamic> json) =>
      _$FindingIntelligenceCitationFromJson(json);
}

/// Mirrors `FindingIntelligenceResponse` exactly. Returned by
/// `GET /findings/{findingId}/intelligence` — the RAG-grounded explanation
/// surfaced when a user opens a finding's detail view. Not wired to a screen
/// in this milestone (see the milestone report's "next milestone" list) but
/// modeled now since the endpoint and shape already exist on the backend.
@freezed
class FindingIntelligence with _$FindingIntelligence {
  const factory FindingIntelligence({
    required String findingId,
    String? cweId,
    String? cweName,
    String? owaspCategory,
    String? owaspName,
    required List<String> mitreTechniqueIds,
    String? pciClause,
    String? rbiClause,
    String? swiftClause,
    required String whyDetected,
    String? plainEnglishExplanation,
    String? businessImpact,
    String? technicalImpact,
    String? recommendedRemediation,
    required List<String> verificationSteps,
    String? codeExample,
    required List<FindingIntelligenceCitation> citations,
    required double confidence,
    required int retrievedCount,
    required bool grounded,
    String? note,
    required double latencyMs,
  }) = _FindingIntelligence;

  factory FindingIntelligence.fromJson(Map<String, dynamic> json) =>
      _$FindingIntelligenceFromJson(json);
}
