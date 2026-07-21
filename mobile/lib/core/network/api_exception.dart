import 'package:dio/dio.dart';

/// Normalized error surfaced to the UI layer. Repositories/services catch
/// [DioException] and rethrow this so widgets never need to know Dio exists.
class ApiException implements Exception {
  ApiException({
    required this.message,
    this.statusCode,
    this.isNetworkError = false,
  });

  factory ApiException.fromDioException(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'The request timed out. Please check your connection and try again.',
          isNetworkError: true,
        );
      case DioExceptionType.connectionError:
        return ApiException(
          message: 'Could not reach the KAVACH server. Please check your connection.',
          isNetworkError: true,
        );
      case DioExceptionType.badCertificate:
        return ApiException(
          message: 'The server\'s security certificate could not be verified.',
          isNetworkError: true,
        );
      case DioExceptionType.cancel:
        return ApiException(message: 'Request cancelled.');
      case DioExceptionType.badResponse:
        return ApiException(
          message: _messageFromResponse(error),
          statusCode: error.response?.statusCode,
        );
      case DioExceptionType.unknown:
      default:
        return ApiException(
          message: error.message ?? 'Something went wrong. Please try again.',
          isNetworkError: true,
        );
    }
  }

  final String message;
  final int? statusCode;
  final bool isNetworkError;

  static String _messageFromResponse(DioException error) {
    final Object? data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final Object? detail = data['detail'];
      if (detail is String) {
        return detail;
      }
      if (detail is List && detail.isNotEmpty) {
        // FastAPI/Pydantic validation error shape: [{"msg": "...", ...}, ...]
        final Object? first = detail.first;
        if (first is Map<String, dynamic> && first['msg'] is String) {
          return first['msg'] as String;
        }
      }
    }
    switch (error.response?.statusCode) {
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to do that.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'This action conflicts with the current state of the resource.';
      case 422:
        return 'The submitted data was invalid.';
      case 500:
      case 502:
      case 503:
        return 'The KAVACH server ran into a problem. Please try again shortly.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  @override
  String toString() => message;
}
