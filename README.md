# Database và lộ trình tạo app bdsgiatot.vn

Ngày thiết kế: 25/09/2026. Phạm vi: SQL có thể thực thi, quy tắc nghiệp vụ, phân quyền và hướng dẫn triển khai app. Bộ này chưa phải website/API đã xây dựng.

## Bắt đầu từ đâu

1. Đọc [Thiết kế dữ liệu](docs/01-thiet-ke-du-lieu.md) để hiểu phạm vi và những điều chỉnh từ ERD.
2. Thực hiện [Các bước tạo app](docs/02-tao-app.md), bắt đầu ở môi trường phát triển.
3. Dùng [API và ma trận quyền](docs/03-api-va-phan-quyen.md) làm hợp đồng giữa frontend và backend.
4. Dùng [Kiểm thử và nghiệm thu](docs/04-kiem-thu.md) trước khi đưa lên hosting.

## Các file SQL

| File | Nội dung |
|---|---|
| `sql/001_schema.sql` | Bảng, khóa, chỉ mục và cấu trúc địa lý |
| `sql/002_business_rules.sql` | Quyền combo, suất Sale, duyệt tin, view công khai, nhật ký |
| `sql/003_security.sql` | RLS, ba nhóm quyền database, lời mời và kích hoạt |
| `sql/004_seed_catalogs.sql` | Việt Nam, tiền tệ khởi đầu và ba loại bất động sản |
| `sql/005_bootstrap_admin.sql` | Tham khảo khởi tạo admin thủ công; không thuộc migration tự động |

Chạy 001–004 theo thứ tự, một lần trên database mới. `npm run db:migrate` tự ghi phiên bản và checksum; chạy lại sẽ bỏ qua bản đã áp dụng. Không sửa migration đã dùng ở production: tạo migration tiếp theo.

## Công nghệ đề xuất

- Website: Next.js App Router, TypeScript; nội dung công khai xuất HTML từ máy chủ.
- API: NestJS, TypeScript, module theo nghiệp vụ; truy vấn tham số bằng thư viện `pg`.
- Dữ liệu: PostgreSQL 17+ và PostGIS; bản phát triển dùng image `postgis/postgis:17-3.5`.
- Ảnh: object storage công khai; hợp đồng và hồ sơ xác minh dùng bucket riêng tư.
- Tác vụ nền: worker đọc outbox trong PostgreSQL. Chưa cần bắt buộc Redis hoặc máy tìm kiếm riêng ở bản đầu.
- Hạ tầng: DNS, HTTPS, CDN/WAF, máy ứng dụng, database riêng, giám sát và sao lưu. Kiến trúc tầng giữ như ERD đã thống nhất.

## Điều kiện kinh doanh được giữ lại

Không đăng ký tự do để đăng tin; doanh nghiệp ký hợp đồng và được cấp combo. Doanh nghiệp phân công Sale trong các dự án được cấp quyền. Chỉ có Mua – Bán/Cho thuê và ba loại Nhà phố/Biệt thự/Shophouse; tìm theo thị trường, quốc gia và tên dự án. Nội dung chỉ Tin tức và Phân tích thị trường; danh bạ gồm môi giới và doanh nghiệp.

## Kiểm tra đã thực hiện

Kết quả máy đọc được nằm ở `tests/last-result.json`. Bộ kiểm thử dùng PGlite với PostGIS và pg_trgm thật, nạp nguyên vẹn SQL 001–004, không thay kiểu geography hoặc bỏ kiểm tra RLS. Đây không thay thế nghiệm thu trên PostgreSQL có nhiều kết nối, môi trường HTTP và giao diện.

Không có dữ liệu khách hàng, mật khẩu mẫu, mức giá combo hay hợp đồng pháp lý soạn sẵn trong bộ này. Những giá trị kinh doanh nhập theo thỏa thuận thực tế.
