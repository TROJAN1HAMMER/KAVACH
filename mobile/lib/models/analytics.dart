import 'package:freezed_annotation/freezed_annotation.dart';

part 'analytics.freezed.dart';
part 'analytics.g.dart';

/// Mirrors `backend/app/schemas/analytics.py::RecentScanSummary`.
@freezed
class RecentScanSummary with _$RecentScanSummary {
  const factory RecentScanSummary({
    required String scanJobId,
    required String repositoryName,
    required String status,
    double? brsScore,
    String? brsRiskLevel,
    String? finishedAt,
  }) = _RecentScanSummary;

  factory RecentScanSummary.fromJson(Map<String, dynamic> json) =>
      _$RecentScanSummaryFromJson(json);
}

/// Mirrors `MyActivitySummary`. Returned by `GET /analytics/my-activity` —
/// scoped to the calling user's own scans, available to every authenticated
/// role.
@freezed
class MyActivitySummary with _$MyActivitySummary {
  const factory MyActivitySummary({
    required int totalScans,
    required Map<String, int> scansByStatus,
    required int totalFindings,
    required Map<String, int> findingsBySeverity,
    double? averageScanDurationSeconds,
    double? averageBrsScore,
    required List<RecentScanSummary> recentScans,
  }) = _MyActivitySummary;

  factory MyActivitySummary.fromJson(Map<String, dynamic> json) =>
      _$MyActivitySummaryFromJson(json);
}

/// Mirrors `TeamMemberActivity`.
@freezed
class TeamMemberActivity with _$TeamMemberActivity {
  const factory TeamMemberActivity({
    required String userId,
    required String email,
    String? fullName,
    required int totalScans,
    required int totalFindings,
    double? averageBrsScore,
  }) = _TeamMemberActivity;

  factory TeamMemberActivity.fromJson(Map<String, dynamic> json) =>
      _$TeamMemberActivityFromJson(json);
}

/// Mirrors `TeamActivitySummary`. Returned by `GET /analytics/team-activity`
/// — requires `team_analytics:read` (admin, security_engineer only).
@freezed
class TeamActivitySummary with _$TeamActivitySummary {
  const factory TeamActivitySummary({
    required int totalScans,
    required int totalFindings,
    required List<TeamMemberActivity> members,
  }) = _TeamActivitySummary;

  factory TeamActivitySummary.fromJson(Map<String, dynamic> json) =>
      _$TeamActivitySummaryFromJson(json);
}
