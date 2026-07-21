import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';

/// Raw HTTP calls for `/risk/*` (business-module and risk-factor-weight
/// configuration, plus a BRS scoring preview). Read access requires
/// `risk_config:read`; every authenticated role holds that permission per
/// the backend's `ROLE_PERMISSIONS`, but writes require
/// `risk_config:write` (admin, security_engineer only).
///
/// Response parsing intentionally returns raw maps for now — the Risk
/// Dashboard screen in this milestone is a placeholder (see the milestone
/// report), so no `BusinessModule`/`RiskFactorWeight` freezed models were
/// added yet. Add them alongside the real screen in the next milestone
/// rather than modeling a response nothing reads.
class RiskService {
  RiskService(this._dio);

  final Dio _dio;

  Future<List<Map<String, dynamic>>> modules() async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.riskModules);
    return (response.data as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> factorWeights() async {
    final Response<dynamic> response =
        await _dio.get<dynamic>(ApiConstants.riskFactorWeights);
    return (response.data as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> preview(Map<String, dynamic> request) async {
    final Response<dynamic> response = await _dio.post<dynamic>(
      ApiConstants.riskPreview,
      data: request,
    );
    return response.data as Map<String, dynamic>;
  }
}
