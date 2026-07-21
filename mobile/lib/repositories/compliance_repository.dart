import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/compliance.dart';
import '../services/scan_service.dart';

/// Domain layer over `GET /scan/{id}/compliance`.
class ComplianceRepository {
  ComplianceRepository(this._scanService);

  final ScanService _scanService;

  Future<ComplianceEngineResult> forScan(String scanJobId) async {
    try {
      return await _scanService.compliance(scanJobId);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
