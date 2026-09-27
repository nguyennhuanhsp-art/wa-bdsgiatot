# Bản app đầu tiên — 25/09/2026

## Kiến trúc triển khai trong thư mục

- `apps/web`: Next.js 16, React 19, server-rendered public catalogue, responsive UI, server-side API proxy.
- `apps/api`: NestJS 11, xác thực session, public catalogue, workspace theo quyền, xử lý ảnh.
- `sql`: giữ nguyên thiết kế PostgreSQL, business functions và Row-Level Security từ bản SQL đã kiểm thử.
- `.local/app-db`: PostgreSQL nhúng PGlite + PostGIS dành cho demo local, dữ liệu lưu bền trên đĩa.
- `.local/uploads`: ảnh tải lên được giải mã, giới hạn kích thước và chuyển WebP bằng Sharp. Chỉ trả ảnh qua endpoint kiểm tra quyền; ảnh của tin đang công khai mới xem được không cần đăng nhập.
- `.local/DEMO-ACCOUNTS.json`: thông tin tài khoản demo, mật khẩu ngẫu nhiên; không đưa vào Git hoặc chia sẻ công khai.

```
Trình duyệt → Next.js :3000 → NestJS :3001
                              ├─ API role + actor_id → RLS
                              ├─ Auth role → mật khẩu Argon2id / token băm
                              └─ Worker role → trạng thái media
```

API chỉ lắng nghe loopback. Chế độ demo đăng nhập nhanh chỉ có khi dùng local embedded database. Launcher đặt rõ `APP_MODE=local-demo`, không sử dụng các biến kết nối database thật.

## Chạy và phát triển

```
npm install
npm run dev
npm run typecheck
npm run build
```

Mở `http://127.0.0.1:3000`. Launcher `MO-APP.cmd` sử dụng bản đã build. Sau khi sửa mã nguồn, build lại trước khi dùng launcher. Không chạy hai API cùng mở một thư mục PGlite. Nếu đang dùng `npm run dev`, dừng bằng Ctrl+C trước khi chuyển sang launcher.

Để cấu hình PostgreSQL ngoài máy cho giai đoạn sau, cấp ba login độc lập theo `scripts/provision-logins.mjs`, thiết lập `DATABASE_API_URL`, `DATABASE_AUTH_URL`, `DATABASE_WORKER_URL` cho tiến trình backend; không dùng launcher demo. Runtime roles không được sở hữu schema hoặc có quyền superuser/bypass RLS. Bật HTTPS, cookie Secure, Origin chính xác và tách kho hồ sơ pháp lý khỏi kho ảnh công khai trước vận hành.

## Các luồng đã nối database

- Danh mục công khai chỉ đọc public views, tự loại bỏ tin hết hạn hoặc hết quyền.
- Search theo loại giao dịch, thị trường, quốc gia, loại hình, từ khóa; phân trang và thứ tự giá.
- Cookie HttpOnly/SameSite Strict; token ngẫu nhiên chỉ lưu bản băm trong database; logout vô hiệu hóa token.
- Kiểm tra Origin cho mọi thay đổi; giới hạn tần suất endpoint xác thực và liên hệ.
- Tạo/sửa bản nháp, tải ảnh, gửi duyệt, quản trị duyệt/từ chối, ẩn tin. Không tự sửa tin đang công khai.
- Mời Sale có giữ suất, kích hoạt lời mời, giao dự án thuộc combo, thu hồi suất ẩn các tin liên quan theo business function.
- Tiếp nhận yêu cầu tư vấn có đồng ý sử dụng thông tin; RLS giới hạn người đọc.

## Kiểm chứng

- `tests/last-result.json`: 36 kiểm thử SQL từ giai đoạn thiết kế dữ liệu.
- `tests/app-result.json`: kiểm thử API có kết nối database và tải ảnh thật.
- `docs/preview/browser-results.json`: kiểm tra tuyến trang ở 1440, 390, 360 px, không lỗi JavaScript, ảnh hỏng hoặc tràn ngang.
- `docs/preview/workflow-results.json`: thao tác UI đăng ký thông báo, đăng nhập vai trò, tạo/sửa bản nháp, quản lý đội ngũ và xem chi tiết kiểm duyệt.
- `docs/preview/*.png`: ảnh chụp màn hình tham khảo.

Các kiểm thử API/UI có tạo dữ liệu minh họa. Đây chưa phải kiểm thử tải, pentest, khôi phục backup cloud hoặc quota trên nhiều kết nối PostgreSQL thật. Không xem PGlite local như cấu hình vận hành đa người dùng.

## Hạng mục tiếp theo

1. UI quản trị tổ chức, tài liệu hợp đồng riêng tư, cấp combo, dự án và biên tập bài viết; hiện có dữ liệu seed để thử luồng cốt lõi.
2. Gửi email kích hoạt/khôi phục mật khẩu, xử lý outbox, dịch vụ chống spam cho form công khai.
3. PostgreSQL thật và object storage; sao lưu có kiểm tra khôi phục, giám sát và thử đồng thời.
4. Hồ sơ và nội dung thật, chính sách dữ liệu, SEO canonical/sitemap/schema theo tên miền được xác nhận, kiểm tra trước khi deploy.

## Nguồn tài nguyên giao diện

Ảnh Unsplash, dùng minh họa kiến trúc và không gán là ảnh thực của các dự án demo:

- https://images.unsplash.com/photo-1580587771525-78b9dba3b914
- John Fornander: https://unsplash.com/photos/Id7u0EkTjBE — photo-1613977257363-707ba9348227.
- Avi Werde: https://unsplash.com/photos/hHz4yrvxwlA — photo-1613490493576-7fde63acd811.

Be Vietnam Pro từ Google Fonts, tải về `apps/web/public/fonts`, giấy phép OFL kèm thư mục. Giao diện dùng màu tham khảo đỏ/trắng/xám; không sử dụng logo hoặc sao chép nội dung thương hiệu Batdongsan.com.vn.
