/**
 * AI Provider Error Resilience & Formatting Utilities
 * Isolates error classification from client instantiation so it can be safely used
 * across Edge Functions, Node test suites, and frontend components.
 */

/**
 * Detects if an AI provider error is transient (e.g. 503 high demand, 429 rate limit, 504 timeout)
 */
export function isAiTransientError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.error || err || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('quá tải') ||
    msg.includes('provider_overloaded') ||
    msg.includes('429') ||
    msg.includes('rate_limited') ||
    msg.includes('resource_exhausted') ||
    msg.includes('504') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
}

/**
 * Translates and formats raw AI errors into helpful, polite Vietnamese messages
 */
export function formatAiErrorMessage(err: any): string {
  if (!err) return 'Đã xảy ra lỗi không xác định khi kết nối với AI.';
  const msg = String(err.message || err.error || err || '');

  if (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('quá tải') ||
    msg.includes('PROVIDER_OVERLOADED')
  ) {
    return 'Mô hình AI của Google hiện đang nhận lượng truy cập cao đột biến (HTTP 503 UNAVAILABLE). Hệ thống đã giữ nguyên toàn bộ nội dung bạn vừa nhập, vui lòng bấm nút "Thử lại" sau ít giây.';
  }

  if (
    msg.includes('429') ||
    msg.includes('RATE_LIMITED') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota')
  ) {
    return 'Đã vượt quá hạn ngạch sử dụng tạm thời của Google Gemini AI (HTTP 429). Yêu cầu đã được lưu lại, vui lòng chờ khoảng 30–60 giây trước khi thử lại.';
  }

  if (
    msg.includes('504') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('GATEWAY_TIMEOUT')
  ) {
    return 'Thời gian phản hồi từ máy chủ AI vượt quá giới hạn (Timeout). Vui lòng thử lại với nội dung ngắn gọn hơn hoặc thử lại sau.';
  }

  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('AUTH_REQUIRED') ||
    msg.includes('FORBIDDEN') ||
    msg.includes('MISSING_API_KEY')
  ) {
    return 'Không thể xác thực quyền truy cập dịch vụ AI. Vui lòng kiểm tra đăng nhập của tài khoản Giáo viên.';
  }

  if (msg.includes('INVALID_INPUT') || msg.includes('INVALID_PROMPT')) {
    return 'Nội dung yêu cầu chưa hợp lệ hoặc quá ngắn. Vui lòng bổ sung thêm thông tin cụ thể.';
  }

  return `Lỗi kết nối AI: ${msg}`;
}
