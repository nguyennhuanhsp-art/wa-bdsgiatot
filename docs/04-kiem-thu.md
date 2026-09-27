# Kiểm thử và nghiệm thu

## 1 Kết quả đã thực hiện

`tests/last-result.json` ghi số bài kiểm thử, thời điểm, phiên bản engine và kết quả từng bài. SQL chạy nguyên vẹn trong PGlite với extension PostGIS và pg_trgm thật. Không dùng SQLite thay PostgreSQL, không bỏ RLS hoặc thay kiểu geography để cho test qua.

Giới hạn: PGlite có một kết nối độc quyền, không chứng minh hành vi nhiều request đồng thời của một PostgreSQL server. Test native được tích hợp trong cùng script và chỉ chạy khi có DATABASE_TEST_URL trỏ vào database thử nghiệm mới, tên kết thúc `_test`. Máy tạo bộ này chưa có Docker/PostgreSQL server để chạy bài native đó.

Các script migration/bootstrap/provision được kiểm tra cú pháp JavaScript; vẫn cần chạy với database thật khi triển khai. Chưa xây hoặc kiểm thử API, giao diện, email, object storage hay deployment.

## 2 Kiểm thử database tự động

```powershell
npm ci
npm run test:sql
```

Nhóm bài kiểm tra bao gồm:

- Tạo đầy đủ schema, functions, RLS, catalogs; nạp được PostGIS và pg_trgm.
- Cấp suất đúng hạn mức; gọi lại cùng suất không tăng số lượng; tài khoản công ty khác không cấp được.
- Sale tạo nháp trên phân công hợp lệ; nháp không công khai; dữ liệu giữa hai công ty tách biệt.
- Sale không tự sửa status thành published; không tự duyệt; admin không duyệt tin thiếu ảnh.
- Công khai tin hợp lệ; tin thứ hai vượt hạn mức bị từ chối; nội dung live không được sửa trực tiếp.
- Giá không thỏa thuận bắt buộc có số tiền dương.
- Khách gửi liên hệ có consent; Sale phụ trách xem được, công ty khác không đọc được.
- API không đọc hash mật khẩu hoặc gọi hàm auth; không tự nâng platform_role.
- Đình chỉ combo hoặc Sale làm tin biến mất khỏi view công khai ngay khi đọc lại.
- Khóa ngoại ghép từ chối sai công ty; reference thanh toán trùng bị chặn.
- Thu hồi suất ẩn tin và giải phóng số suất; lời mời giữ suất; token chỉ dùng được một lần.
- Context người dùng hết sau transaction; RLS bật cho mọi bảng nghiệp vụ.
- Trên native PostgreSQL: hai kết nối tranh một slot công khai, đúng một lần thành công.

## 3 Nghiệm thu bổ sung trước production

| Nhóm | Kịch bản cần đạt |
|---|---|
| Cạnh tranh suất | Hai admin cùng cấp suất cuối: chỉ một thành công; retry không tạo suất đôi |
| Nhiều kết nối | 20 request duyệt khi còn 3 slot: không quá 3 tin công khai; không treo khóa |
| Connection pool | Request công ty A rồi B dùng cùng client trả pool: không lẫn app.user_id |
| Thu hồi quyền | Suspend hợp đồng, doanh nghiệp, combo, grant hoặc Sale: không còn tin công khai qua cache/API |
| Hiệu lực thời gian | Kiểm tra đúng thời điểm ends_at/expires_at, không đợi cron để chặn hiển thị |
| Thời hạn thay đổi | Rút ngắn hợp đồng/combo, kiểm tra quyền con và thông báo tin bị ảnh hưởng |
| Lời mời | Token sai, hết hạn, dùng lại, user đã có tài khoản, đồng thời kích hoạt hai lần |
| Xác thực | Đăng nhập sai nhiều lần, refresh replay, reset password, block user và thu hồi session |
| Upload | Ảnh giả MIME, ảnh cực lớn, file lỗi, object key của công ty khác, URL private hết hạn |
| Phân quyền route | Đổi UUID công ty/tin/Sale trong URL, body, header; không vượt quyền |
| Nội dung | XSS trong mô tả và bài viết bị chặn; không log email/token/mật khẩu |
| SEO | HTML có nội dung, canonical chính xác, sitemap chỉ URL công khai, không index admin |
| Worker | Retry không gửi email hai lần ngoài ý muốn; outbox không mất sự kiện khi tiến trình chết |
| Khôi phục | Khôi phục database và object storage vào staging rồi kiểm tra liên kết ảnh/tài liệu |
| Hiệu năng | Thử với dung lượng gần thực tế; xem EXPLAIN ANALYZE; không chọn cấu hình hosting chỉ theo số lượt tháng |

## 4 Bộ dữ liệu nghiệm thu

Chuẩn bị ít nhất: hai công ty, mỗi công ty một quản trị; ba Sale; một dự án trong nước và một ngoài nước; hai combo có hạn mức thấp; hồ sơ có cả bán và cho thuê; đủ ba loại sản phẩm; tin nháp, chờ duyệt, công khai và hết hạn. Dùng dữ liệu giả có đánh dấu rõ, không đưa fixture test vào production.

## 5 Điều kiện hoàn thành app bản đầu

Admin ký duyệt hồ sơ và cấp combo được; công ty mời/phân công Sale được; Sale tạo/gửi duyệt được; khách tìm đúng dự án và gửi liên hệ được; người có quyền nhìn thấy khách; không vượt hạn mức hoặc lộ dữ liệu công ty khác; SEO và phục hồi dữ liệu được kiểm tra. Đạt các điều kiện này mới chuyển sang mở rộng tính năng.
