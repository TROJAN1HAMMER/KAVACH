import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/finding_intelligence.dart';

/// Raw HTTP call for `GET /findings/{findingId}/intelligence` — the
/// RAG-grounded, citation-backed explanation for a single finding. Not
/// wired to a screen yet (see the milestone report); modeled and callable
/// now so the Finding Explorer's detail view has a real service to call
/// against in the next milestone instead of starting from scratch.
class FindingIntelligenceService {
  FindingIntelligenceService(this._dio);

  final Dio _dio;

  Future<FindingIntelligence> get(String findingId) async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.findingIntelligence(findingId));
    return FindingIntelligence.fromJson(response.data as Map<String, dynamic>);
  }
}
