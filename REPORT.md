# Báo cáo cập nhật dự án Snowboard v2.0

## Tóm tắt các thay đổi chính
- **Sửa lỗi đường dẫn tương đối:** Hàm `sanitizeIconUrl` được viết lại để luôn trả về đường dẫn tương đối an toàn khi deploy trên GitHub Pages (sub-path).
- **Loại bỏ `prompt()` và `confirm()`:** Thay thế bằng modal tùy chỉnh (`renameModal`, `importModal`) để tương thích tốt với iOS Safari.
- **Sửa lỗi trùng lặp app:** Thêm kiểm tra `includes(id)` trong `selectAppToAdd`.
- **Hoàn thiện Service Worker:** `sw.js` được sửa lỗi cú pháp và cache đầy đủ các file cần thiết.
- **Tối ưu iOS/PWA:** Sử dụng `height: 100dvh` cho body, xử lý safe-area tốt hơn, thêm meta `apple-mobile-web-app-status-bar-style` và nút đóng onboarding.
- **Cải thiện trải nghiệm kéo thả xóa:** Thêm hiệu ứng phóng to thùng rác khi app được kéo vào.
- **Lưu trạng thái Fast Rename:** Trạng thái `fastRenameMode` được lưu vào localStorage và được khôi phục khi tải lại trang.
- **Fallback Clipboard:** Thêm phương thức dự phòng cho `navigator.clipboard` khi API không khả dụng.
- **Tối ưu thời gian Onboarding:** Giảm từ 15 giây xuống 3 giây.
- **Cải thiện responsive:** Các giá trị max-height sử dụng `100dvh` để thích ứng với thanh địa chỉ động.

## Cấu trúc thư mục chuẩn