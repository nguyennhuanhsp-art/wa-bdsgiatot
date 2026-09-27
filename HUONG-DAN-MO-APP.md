# Mở và trải nghiệm bdsgiatot.vn

Mã nguồn và dữ liệu bản thử nghiệm nằm tại **D:\codex\WA_bdsgiatot**.

## Mở website

1. Mở thư mục trên.
2. Nhấp đúp **MO-APP.cmd**.
3. Chờ website mở tại **http://127.0.0.1:3000**. Lần khởi động đầu có thể mất khoảng 20–50 giây.

Nếu app đang chạy, chị mở thẳng địa chỉ trên. Bản này chỉ mở trên máy đang chạy app; địa chỉ này không dùng để gửi cho khách hoặc mở từ điện thoại khác.

## Thử các vai trò

Vào **Đăng nhập**, chọn một nút trong **Trải nghiệm nhanh các vai trò**:

- **Sale:** tạo bản nháp → thêm ảnh → sửa nội dung → gửi duyệt. Tin chỉ gắn với dự án đã được giao.
- **Quản trị:** mở **Chi tiết** để kiểm tra nội dung và ảnh → duyệt đăng hoặc yêu cầu sửa. Có thể ẩn tin.
- **Doanh nghiệp:** vào **Đội ngũ & combo** → mời Sale → lấy link kích hoạt thử nghiệm → phân công dự án → quản lý suất tài khoản.

Trong vai trò **Quản trị**, mở **Quản trị hệ thống** để tạo doanh nghiệp, mời quản lý, tạo dự án, lưu PDF hợp đồng riêng tư, cấp combo và biên tập bài viết. Xem quy trình trong `docs/07-quan-tri-doanh-nghiep.md`.

Để chuyển vai trò, bấm **Đăng xuất**, sau đó chọn vai trò khác ở trang đăng nhập.

Khi thử lời mời Sale mới, mở link kích hoạt trong cửa sổ ẩn danh và đặt mật khẩu ít nhất 12 ký tự. Sau khi kích hoạt, quản lý doanh nghiệp có thể giao dự án cho tài khoản đó.

## Thử tìm kiếm và nhận tư vấn

- Trang chủ có hai nhu cầu **Mua – Bán** và **Cho thuê**.
- Tìm theo tên dự án hoặc khu vực; lọc trong/ngoài nước, quốc gia và loại hình.
- Mở một tin đăng, điền biểu mẫu tư vấn. Yêu cầu được lưu vào mục **Khách hàng quan tâm** của tài khoản có quyền phụ trách.
- Bấm **Đăng ký** sẽ hiện thông báo liên hệ doanh nghiệp để được cấp tài khoản; không có đăng ký đăng tin tự do.

## Phạm vi bản đã làm

Giao diện đỏ – trắng – xám, có bố cục riêng cho điện thoại; trang chủ, tìm kiếm, dự án, tin đăng, tin tức, phân tích thị trường, danh bạ, đăng nhập và khu vực quản lý theo vai trò. Luồng đăng tin, tải ảnh, duyệt tin, mời/kích hoạt Sale, giao dự án và lưu khách quan tâm có kết nối cơ sở dữ liệu.

Dữ liệu lưu bền trên máy trong `.local/app-db`; đóng trình duyệt không làm mất dữ liệu. Ảnh tự tải lên lưu trong `.local/uploads`. Không xóa thư mục `.local` nếu cần giữ dữ liệu. Để tắt bản mở bằng launcher, lưu xong các thao tác rồi nhấp đúp **TAT-APP.cmd**. Muốn sao lưu bản local, dừng app trước khi sao chép cả thư mục `.local`; không sao chép cơ sở dữ liệu đang chạy.

## Những phần chưa đưa vào vận hành thật

- Dự án, doanh nghiệp, mức giá và hợp đồng trong bản này đều là minh họa. Ảnh là ảnh kiến trúc minh họa, không chứng minh thông tin dự án.
- Chưa gửi email/SMS, chưa thu tiền, chưa nhận hoặc xác minh hồ sơ pháp lý thật.
- Đã có giao diện quản trị doanh nghiệp, dự án, PDF hợp đồng riêng tư, cấp combo và biên tập bài viết. Trước khi vận hành thật cần hoàn thiện dịch vụ gửi thư, quy trình thẩm định hồ sơ, lưu trữ và sao lưu trên máy chủ.
- Chưa gắn tên miền hay đưa lên hosting. Trước khi mở cho khách, cần dùng PostgreSQL quản lý riêng, nơi lưu ảnh và tài liệu riêng tư, sao lưu có phục hồi thử, gửi email và cấu hình môi trường thật.
- Các trang đang đặt `noindex` để dữ liệu thử nghiệm không lên công cụ tìm kiếm. Chỉ bật SEO công khai sau khi có tên miền và nội dung thật.

Không cần chuyển qua Cursor để sử dụng hay tiếp tục phát triển bản này.

