# CONTRIBUTING

Cảm ơn bạn đã quan tâm đóng góp cho Open-Applist (Snowboard).
Dưới đây là hướng dẫn nhanh để bạn có thể đóng góp an toàn và nhất quán.

## Nội dung phù hợp để đóng góp
- Thêm mục Webclip / Shortcut mới vào `db.json` (ứng dụng bên thứ ba).
- Thêm app hệ thống (icon cục bộ) vào `system-app.json` cùng file ảnh trong thư mục `systemapp/`.
- Cập nhật hoặc bổ sung tệp ngôn ngữ trong `Language/` (ví dụ `vi.json`, `en_US.json`).
- Sửa lỗi giao diện/logic trong `index.html`, CSS trong `css/`, hoặc scripts liên quan.
- Tài liệu: README, CONTRIBUTING, hoặc tạo hướng dẫn cài đặt/FAQ.

## Quy trình đóng góp (recommended)
1. Fork repo này vào tài khoản của bạn.  
2. Tạo nhánh mới cho thay đổi: `git checkout -b feat/add-my-webclip`  
3. Thực hiện thay đổi, commit với thông điệp rõ ràng (ví dụ: `Add: webclip for example.com`).  
4. Push nhánh lên fork và mở Pull Request (PR) về branch mặc định (master) của repo này.  
5. Trong PR, mô tả rõ: mục đích thay đổi, cách kiểm thử, và file nào bị ảnh hưởng.  

## Hướng dẫn cụ thể khi thêm app (db.json)
- Mở `db.json` và thêm một key mới có dạng unique bundle id (ví dụ `com.example.myapp`).
- Giá trị là object chứa ít nhất:
  - `Name`: Tên hiển thị (string)
  - `icon`: url ảnh (http/https) hoặc đường dẫn nội bộ (ví dụ `icons/myicon.png`)

Ví dụ:
{
  "com.example.myapp": {
    "Name": "My App",
    "icon": "https://example.com/myicon.png"
  }
}

Lưu ý:
- Nếu icon là URL bên ngoài, kiểm tra rằng URL cho phép truy cập công khai (no auth).
- Không đưa khóa bí mật, API key, hoặc dữ liệu nhạy cảm vào repo.
- Nếu muốn thêm nhiều icons cục bộ, thêm file ảnh vào thư mục `icons/` hoặc `systemapp/` và tham chiếu đường dẫn tương ứng.

## Thêm app hệ thống (system-app.json)
- Thêm entry mới vào `system-app.json` với bundle id làm key và object có `Name` và `icon` (điểm tới file trong `systemapp/`).
- Đặt file icon trong thư mục `systemapp/` với tên phù hợp.

Ví dụ:
"com.apple.example": { "Name": "Example", "icon": "systemapp/Example.png" }

## Ngôn ngữ (i18n)
- Các file ngôn ngữ đặt trong thư mục `Language/` theo tên: `en_US.json`, `vi.json`, `en.json`,...
- Các tệp là JSON chứa object phân cấp theo key (ví dụ `effects.title`, `button.close`).
- Khi thêm key mới, cập nhật cả file tiếng Anh (`en_US.json`) và, nếu có, tiếng Việt (`vi.json`).

## Quy ước code & style
- Giữ HTML/JS/CSS rõ ràng, indent 2 spaces.
- Đối với thay đổi JS lớn, tách ra branch riêng và mô tả rõ trong PR.
- Không commit file nhị phân lớn không cần thiết.

## Kiểm thử cục bộ
- Đây là repo static; bạn có thể chạy bằng một static server để test:
  - Python 3: `python -m http.server 8000` (chạy trong thư mục repo) -> mở `http://localhost:8000`
  - hoặc dùng `npx http-server` nếu có Node.js
- Mở trang bằng Safari (trên iPhone hoặc iPad) để kiểm tra tính năng "Add to Home Screen" và tích hợp Shortcuts.
- Kiểm tra behavior offline: đăng ký Service Worker (sw.js) và thử load khi offline.

## Kiểm tra trước khi gửi PR
- Chắc chắn không để credential, API keys, hay dữ liệu cá nhân trong commit.  
- Kiểm tra JSON hợp lệ (`jq . db.json` hoặc `python -m json.tool db.json`).  
- Kiểm tra ảnh/icon tồn tại và kích thước hiển thị ổn (thường vuông, 100x100 hoặc tương đương).
- Chạy qua UI để đảm bảo không có lỗi console rõ ràng.

## License
- Mã nguồn trong repo được phát hành theo MIT License (xem file `LICENSE`).
- Khi đóng góp, bạn đồng ý rằng đóng góp của bạn có thể được phát hành lại theo MIT License.

## Thêm header bản quyền (nếu cần)
- Nếu bạn muốn thêm header bản quyền vào file nguồn, dùng SPFDX tag ngắn: `SPDX-License-Identifier: MIT` cùng dòng Copyright.
- Ví dụ (JavaScript):
/*
 * Copyright (c) 2026 Ngocsen
 * SPDX-License-Identifier: MIT
 */

## Ghi chú cuối
- Nếu bạn không chắc chắn nên làm gì, mở một Issue trước để thảo luận.  
- Mọi PR có thể được yêu cầu chỉnh sửa — vui lòng theo dõi phản hồi và cập nhật PR.

Cảm ơn bạn — mọi đóng góp đều được hoan nghênh!
