package com.techstore1.techstore1.controller;

import jakarta.persistence.OptimisticLockException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuth(AuthenticationException ex) {
        // Do not reveal authentication internals.
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, "Sai tài khoản hoặc mật khẩu.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException ex) {
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().isEmpty()
                ? "Dữ liệu không hợp lệ."
                : ex.getBindingResult().getFieldErrors().get(0).getDefaultMessage();

        return buildErrorResponse(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleNotReadable(HttpMessageNotReadableException ex) {
        // tac dung code: tra ve loi 400 ro rang khi JSON gui len sai dinh dang thay vi thong bao he thong ban.
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String root = findRootMessage(ex).toLowerCase();

        if (root.contains("incorrect string value") || root.contains("character set")) {
            // tac dung code: thong bao ro rang khi DB dang dung collation cu khong luu duoc tieng Viet.
            return buildErrorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Database chưa hỗ trợ UTF-8 đầy đủ. Vui lòng chuyển collation sang utf8mb4 cho bảng orders và order_status_history."
            );
        }

        if (root.contains("foreign key") || root.contains("constraint")) {
            return buildErrorResponse(HttpStatus.BAD_REQUEST, "Không thể xóa dữ liệu vì còn bản ghi liên quan");
        }

        if (root.contains("duplicate entry")) {
            return buildErrorResponse(HttpStatus.BAD_REQUEST, "Dữ liệu bị trùng lặp");
        }
        if (root.contains("data too long")) {
            return buildErrorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung nhập quá dài so với giới hạn lưu trữ. Vui lòng rút gọn mô tả/sử dụng dữ liệu ngắn hơn."
            );
        }

        return buildErrorResponse(HttpStatus.BAD_REQUEST, "Dữ liệu không hợp lệ hoặc vi phạm ràng buộc CSDL");
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(DataAccessException ex) {
        String root = findRootMessage(ex).toLowerCase();

        if (root.contains("data truncated") && root.contains("payment_method")) {
            // tac dung code: goi y ro DB dang schema cu enum(BANK_TRANSFER,COD) de de khoanh vung loi.
            return buildErrorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Cột payment_method trong database đang là schema cũ. Hệ thống đã fallback BANK_TRANSFER cho đơn online."
            );
        }
        if (root.contains("unknown column") || root.contains("table") && root.contains("doesn't exist")) {
            // tac dung code: thong bao ro schema DB chua cap nhat thay vi tra 500 chung chung.
            return buildErrorResponse(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Schema database chưa đồng bộ. Vui lòng bật spring.jpa.hibernate.ddl-auto=update và khởi động lại."
            );
        }
        if (root.contains("communications link failure") || root.contains("connection refused")) {
            return buildErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, "Không kết nối được database.");
        }

        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi truy cập dữ liệu. Vui lòng thử lại.");
    }

    @ExceptionHandler({ObjectOptimisticLockingFailureException.class, OptimisticLockException.class})
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(Exception ex) {
        // Tell users to retry when concurrent update modifies same row (e.g., stock/order conflict).
        return buildErrorResponse(HttpStatus.CONFLICT, "Dữ liệu vừa thay đổi bởi thao tác khác. Vui lòng thử lại.");
    }

    @ExceptionHandler(TransactionSystemException.class)
    public ResponseEntity<Map<String, Object>> handleTransactionSystem(TransactionSystemException ex) {
        return handleTransactionSystemByRoot(findRootMessage(ex));
    }

    private ResponseEntity<Map<String, Object>> handleTransactionSystemByRoot(String rawRootMessage) {
        String root = rawRootMessage == null ? "" : rawRootMessage.toLowerCase();
        if (root.contains("not-null property references a null or transient value")) {
            // tac dung code: thong bao ro loi rang buoc not-null o entity/db.
            return buildErrorResponse(HttpStatus.BAD_REQUEST, "Dữ liệu bắt buộc đang bị thiếu khi lưu giao dịch.");
        }
        if (root.contains("constraint") || root.contains("foreign key")) {
            return buildErrorResponse(HttpStatus.BAD_REQUEST, "Dữ liệu vi phạm ràng buộc CSDL.");
        }
        if (root.contains("incorrect string value") || root.contains("character set")) {
            return buildErrorResponse(HttpStatus.BAD_REQUEST, "Database chưa hỗ trợ UTF-8 đầy đủ.");
        }

        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi giao dịch dữ liệu. Vui lòng thử lại.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        if ("TransactionSystemException".equals(ex.getClass().getSimpleName())) {
            // tac dung code: fallback khi exception cung ten TransactionSystemException nhung khac package.
            return handleTransactionSystemByRoot(findRootMessage(ex));
        }
        if (ex instanceof NullPointerException) {
            String root = findRootMessage(ex).toLowerCase();
            if (root.contains("longjavatype.next") || root.contains("current is null")) {
                // tac dung code: huong dan ro khi DB cu co products.version null gay loi optimistic lock.
                return buildErrorResponse(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Dữ liệu sản phẩm cũ đang thiếu version. Vui lòng khởi động lại ứng dụng để hệ thống tự sửa dữ liệu."
                );
            }
        }
        // Keep logs for debugging but do not expose stack/internal error details to clients.
        log.error("Unhandled server error", ex);
        String errorCode = ex.getClass().getSimpleName();
        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Hệ thống đang bận, vui lòng thử lại sau. (ERR: " + errorCode + ")"
        );
    }

    private ResponseEntity<Map<String, Object>> buildErrorResponse(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }

    private String findRootMessage(Throwable throwable) {
        Throwable cursor = throwable;
        String message = throwable == null ? "" : String.valueOf(throwable.getMessage());
        while (cursor != null) {
            if (cursor.getMessage() != null && !cursor.getMessage().isBlank()) {
                message = cursor.getMessage();
            }
            cursor = cursor.getCause();
        }
        return message == null ? "" : message;
    }
}
