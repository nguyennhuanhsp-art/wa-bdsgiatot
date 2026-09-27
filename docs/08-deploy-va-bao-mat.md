# Đưa mã nguồn lên Git và triển khai demo

## Trạng thái

Chuẩn bị repository riêng tư và bản Docker demo có mật khẩu truy cập. Chỉ công bố URL sau khi xác nhận tài khoản Git/hosting, đặt secrets và kiểm tra deployment thực tế. Không coi bản chạy localhost là link gửi cho khách.

## Demo chia sẻ

- Image từ `Dockerfile`, lệnh chạy `deploy/start-demo.mjs`.
- Chỉ cổng web được công khai; API vẫn bind `127.0.0.1:3001` trong cùng container.
- `APP_MODE=hosted-demo`, `APP_ORIGIN` phải là URL HTTPS thật, `COOKIE_SECURE=true`.
- `DEMO_ACCESS_USER` và mật khẩu ngẫu nhiên tối thiểu 32 ký tự đặt trong secret manager của hosting. Xem tên biến ở `deploy/hosted-demo.env.example`.
- Lớp mật khẩu bao phủ trang, API proxy và tài nguyên. Sau lớp này, backend vẫn kiểm tra session, vai trò và RLS cho từng thao tác.
- Demo chỉ chứa dữ liệu giả lập. Không nối database sản xuất. Không tiếp nhận form thông tin liên hệ hoặc upload hợp đồng từ bản chia sẻ.
- Khách được mời có thể thử vai trò quản trị; vì vậy mật khẩu demo là quyền vào môi trường thử nghiệm chung. Không dùng cơ chế này làm tài khoản khách hàng thật.
- Dữ liệu demo ở filesystem container, có thể mất khi redeploy/restart tùy nền tảng. Chỉ chạy một instance, không autoscale PGlite. Đây là lựa chọn tạm cho trình diễn, không phải kiến trúc sản xuất.
- Tất cả trang demo giữ `noindex`, không mở lập chỉ mục.
- Container cần được build/test trên Linux trước khi công bố; nếu máy làm việc không có Docker, chỉ kiểm tra build Node là chưa đủ chứng minh container đã chạy.

## Repository

Mặc định tạo repository **private**. Không commit `.local`, `.env`, secrets, database, hợp đồng, ảnh khách upload, cache, node_modules hoặc build output. Kiểm tra danh sách staged và quét mẫu secret trước lần push đầu. Dùng quyền deploy chỉ cho repository của dự án; không đưa token Git vào mã nguồn hoặc Docker image.

Sau khi có repository và quyền truy cập: thêm remote đã xác nhận → push nhánh `main` → kết nối hosting với repo → nhập secrets → build/deploy → kiểm tra URL HTTPS không có mật khẩu phải trả 401 → đăng nhập demo → thử các vai trò và mobile → gửi link cùng thông tin truy cập riêng cho người nhận.

## Kiến trúc vận hành thật khi dữ liệu tăng

| Thành phần | Nơi lưu | Nguyên tắc truy cập |
|---|---|---|
| Website/API | Hosting ứng dụng độc lập | HTTPS; API xác thực và kiểm tra quyền; không dùng tài khoản demo |
| Khách hàng, doanh nghiệp, sản phẩm, quyền dự án | PostgreSQL quản lý riêng | Kết nối phía server, runtime role tối thiểu, RLS theo doanh nghiệp, không lộ database URL cho trình duyệt |
| Ảnh/video gốc và tệp đang chờ kiểm tra | Object storage riêng tư | Backend cấp quyền upload ngắn hạn sau kiểm tra quyền/hạn mức; giới hạn kích thước và loại tệp |
| Ảnh đã duyệt dùng trên tin công khai | Khu vực media được duyệt + CDN | Chỉ công khai phiên bản đã xử lý; giữ bản gốc riêng tư, có quy trình thu hồi cache khi ẩn tin |
| Video trình chiếu | Object storage + dịch vụ chuyển mã/streaming | Xử lý nền, thumbnail, giới hạn thời lượng; không ghi video nhị phân vào PostgreSQL |
| Hợp đồng, tài liệu pháp lý | Bucket riêng tư tách biệt | Không gắn CDN công khai; kiểm tra quyền trước mỗi lần tải/link có hạn; ghi nhật ký |
| Backup | Khu vực sao lưu tách khỏi ứng dụng | Backup database và object storage riêng; versioning/retention; phục hồi thử định kỳ |

Database lưu metadata tệp (owner, tenant, storage key, trạng thái, dung lượng, MIME), không lưu video lớn trực tiếp. Chức năng video chưa được triển khai: cần pipeline upload → kiểm tra → chuyển mã → duyệt → phát, không chỉ thêm một nút upload.

## Điều kiện trước khi nhận dữ liệu khách hàng thật

- Bỏ đăng nhập nhanh theo vai trò; xác thực tài khoản thực, MFA cho quản trị, khôi phục mật khẩu và gửi thư có giới hạn tần suất.
- Tách môi trường demo/staging/production và khóa riêng; không sao chép dữ liệu khách hàng thật sang demo.
- Không dùng database owner/superuser/bypass-RLS trong runtime; API kiểm tra vai trò kết nối khi khởi động.
- Bật TLS đến database/object storage, hạn chế mạng đến database, giữ secrets phía server.
- Bổ sung quét mã độc, quota upload, kiểm tra chữ ký định dạng, xử lý ảnh loại metadata và pipeline video có giới hạn.
- Chống spam form và brute force; logging không ghi mật khẩu, token, nội dung hợp đồng hoặc thông tin liên hệ đầy đủ.
- Kiểm thử tenant isolation trên PostgreSQL thật và nhiều kết nối; rà quyền cho mọi API mới.
- Sao lưu tự động + diễn tập phục hồi; backup database không thay thế backup ảnh/video.
- Quy trình thời hạn lưu/xóa dữ liệu, phân quyền nhân viên, xử lý sự cố và giám sát.

Các mục trên là kế hoạch vận hành cần triển khai và kiểm chứng, không phải chứng nhận an toàn tuyệt đối của bản demo.

## Nền tảng tham khảo, chưa mua dịch vụ

- Render có triển khai Docker từ Git; filesystem mặc định tạm thời, persistent disk áp dụng dịch vụ trả phí: https://render.com/docs/docker và https://render.com/docs/disks
- Supabase là một lựa chọn PostgreSQL quản lý; cần chọn gói backup/PITR phù hợp và thử phục hồi: https://supabase.com/docs/guides/database/overview
- Cloudflare R2 là một lựa chọn object storage tương thích S3, có URL ký hạn dùng: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; giá và các loại thao tác: https://developers.cloudflare.com/r2/pricing/

Chưa chốt nhà cung cấp hoặc ngân sách, chưa tạo bất kỳ dịch vụ trả phí nào.
