import 'package:freezed_annotation/freezed_annotation.dart';

part 'risk_summary.freezed.dart';

/// There is no dedicated "risk summary" endpoint on the backend — BRS
/// (Banking Risk Score) and attack-surface-exposure numbers ride along on
/// `ScanJob` (per-scan) and on `MyActivitySummary`/`TeamActivitySummary`
/// (aggregate `averageBrsScore`). This type is a **client-side composition**
/// of those already-real fields for the Risk Dashboard screen — every field
/// below is copied verbatim from an existing backend response, nothing here
/// is invented or backed by a request of its own.
///
/// Deliberately not `@JsonSerializable` — it is never deserialized directly
/// from an HTTP response, only built in Dart from a [ScanJob] or an
/// activity-summary model via [RiskSummary.fromScanJob].
@freezed
class RiskSummary with _$RiskSummary {
  const factory RiskSummary({
    required String scanJobId,
    required String repositoryName,
    double? brsScore,
    String? brsRiskLevel,
    double? attackSurfaceExposureScore,
    String? attackSurfaceExposureLevel,
    DateTime? finishedAt,
  }) = _RiskSummary;

  const RiskSummary._();
}
