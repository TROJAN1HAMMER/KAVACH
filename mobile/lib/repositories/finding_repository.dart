import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/finding.dart';
import '../models/finding_intelligence.dart';
import '../services/finding_intelligence_service.dart';
import '../services/scan_service.dart';

/// Domain layer over a scan's findings (`GET /scan/{id}/findings`) and a
/// single finding's RAG-grounded intelligence
/// (`GET /findings/{id}/intelligence`).
class FindingRepository {
  FindingRepository({
    required ScanService scanService,
    required FindingIntelligenceService intelligenceService,
  })  : _scanService = scanService,
        _intelligenceService = intelligenceService;

  final ScanService _scanService;
  final FindingIntelligenceService _intelligenceService;

  Future<FindingList> forScan(String scanJobId) async {
    try {
      return await _scanService.findings(scanJobId);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<FindingIntelligence> intelligence(String findingId) async {
    try {
      return await _intelligenceService.get(findingId);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
