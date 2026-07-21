import 'package:freezed_annotation/freezed_annotation.dart';

part 'repository.freezed.dart';
part 'repository.g.dart';

/// Mirrors `backend/app/schemas/repository.py::RepositoryResponse`. There is
/// no `POST /repositories` — a `Repository` row is created implicitly by
/// `POST /scan` (zip upload) or `POST /scan/repository` (URL submit); this
/// model is only ever read via `GET /repositories`.
@freezed
class Repository with _$Repository {
  const factory Repository({
    required String id,
    required String name,
    String? url,
    required String provider, // "upload" | "github" | "gitlab" | "bitbucket"
    String? defaultBranch,
    required bool scheduledScanEnabled,
  }) = _Repository;

  factory Repository.fromJson(Map<String, dynamic> json) =>
      _$RepositoryFromJson(json);
}
