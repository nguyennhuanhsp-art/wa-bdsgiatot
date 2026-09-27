# Quản trị doanh nghiệp, dự án và combo

Cập nhật ngày 27/09/2026. Tài liệu này bổ sung bản đầu tiên trong `06-ban-app-dau-tien.md`.

## Cách mở

Nhấp đúp `MO-APP.cmd`, vào **Đăng nhập → Quản trị → Quản trị hệ thống**. Đường dẫn trực tiếp: http://127.0.0.1:3000/quan-tri. Tài khoản Sale hoặc quản lý doanh nghiệp không được vào API quản trị nền tảng.

## Cấp quyền cho một doanh nghiệp mới

1. **Doanh nghiệp:** nhập tên pháp nhân, mã đăng ký, quốc gia, đường dẫn không dấu và giới thiệu. Bản ghi mới ở trạng thái chờ xác nhận.
2. Sau khi người phụ trách đối chiếu hồ sơ, chọn **Xác nhận & kích hoạt**. Đây là xác nhận của người quản trị, không phải kết luận pháp lý tự động của phần mềm.
3. Trong **Mời quản lý doanh nghiệp**, chọn doanh nghiệp, nhập tên và email. Bản local trả link kích hoạt; chưa gửi thư. Mở link trong cửa sổ ẩn danh để thử tài khoản mới.
4. **Dự án:** nhập thông tin và chọn ít nhất một trong ba loại hình Nhà phố, Biệt thự, Shophouse. Lưu bản nháp, sau đó chọn **Mở dự án**. Dự án chỉ xuất hiện trong danh mục công khai khi có tin đang hiển thị đủ điều kiện.
5. **Hợp đồng & combo:** chọn doanh nghiệp, nhập số hợp đồng, ngày ký, thời hạn và tải bản PDF đã ký. Hệ thống lưu ở trạng thái nháp. PDF tối đa 15 MB, kiểm tra định dạng cơ bản; không tự thẩm định nội dung.
6. Mở bản PDF để kiểm tra, sau đó chọn **Xác nhận kích hoạt**. Combo không được cấp khi hợp đồng chưa hoạt động.
7. Trong **Cấp combo dự án**, chọn hợp đồng, tên combo, số tài khoản Sale, số tin hiển thị và các dự án được phân phối. Xác nhận đã đối chiếu phạm vi phân phối rồi cấp combo. Thời hạn combo và quyền dự án lấy theo hợp đồng.
8. Đăng nhập tài khoản quản lý doanh nghiệp để mời Sale và giao các dự án trong combo. Sale phải kích hoạt lời mời trước khi sử dụng tài khoản.

Tạm dừng doanh nghiệp, hợp đồng, combo hoặc dự án sẽ làm quyền liên quan không còn hiệu lực. Các public views tự loại tin không đủ quyền, không phụ thuộc thao tác sửa từng tin.

## Tài liệu riêng tư

- PDF nằm trong `.local/private-documents`, ngoài thư mục web công khai.
- Đường dẫn tải kiểm tra session và phân quyền doanh nghiệp tại database. Quản trị nền tảng và quản lý đúng doanh nghiệp mới được tải; Sale, doanh nghiệp khác và khách chưa đăng nhập bị chặn.
- Tệp được trả như tài liệu tải xuống, kèm `no-store`, `nosniff` và CSP sandbox. Không đưa storage key ra API danh sách.
- Hợp đồng có sẵn trong seed đầu tiên chỉ là dữ liệu mẫu, chưa có PDF; giao diện không hiện nút tải giả cho bản này.
- Trước vận hành thật cần kho tài liệu riêng tư, kiểm tra mã độc, nhật ký truy cập tài liệu và quy trình lưu trữ/sao lưu phù hợp. Cấu hình local không phải dịch vụ lưu trữ sản xuất.

## Biên tập nội dung

Mục **Nội dung** chỉ có Tin tức và Phân tích thị trường. Soạn bài và thông tin SEO → lưu nháp → xuất bản. Bài nháp không xuất hiện công khai. Muốn sửa bài đã xuất bản, chọn **Ẩn & sửa**, rồi **Chỉnh sửa bài**. Tiêu đề SEO và mô tả SEO được dùng trong metadata của trang bài viết; bản local vẫn giữ `noindex`.

## Mở, tắt và lưu dữ liệu

- `MO-APP.cmd`: mở bản đã biên dịch và trình duyệt.
- `TAT-APP.cmd`: dừng đúng các tiến trình do launcher tạo cho dự án này. Lưu xong thao tác trước khi tắt. Không dừng các dự án Node khác.
- Sau khi sửa mã nguồn: dừng app, chạy `npm run build`, rồi mở lại.
- Khi sao lưu bản local, dừng app rồi sao chép toàn bộ `.local` (database, ảnh và PDF). Giữ riêng thông tin tài khoản demo, không đưa vào Git.

## Kiểm chứng bản bổ sung

- `tests/admin-result.json`: 17 kiểm thử API, gồm chặn quyền quản trị, PDF không công khai, cách ly doanh nghiệp, điều kiện kích hoạt hợp đồng, cấp combo, mời và giao dự án cho Sale mới, thu hồi hiệu lực và xuất bản/ẩn nội dung.
- `docs/preview/admin/result.json`: 12 lượt kiểm tra bố cục (4 mục ở 1440/390/360 px), 7 thao tác giao diện, không lỗi JavaScript hoặc tràn ngang.
- Nhật ký thay đổi phạm vi tổ chức, hợp đồng, dự án, combo và quyền phân phối dùng các trigger audit đã có trong SQL.

Các doanh nghiệp/dự án được tạo trong kiểm thử có nhãn kiểm thử và được tạm dừng sau kiểm tra. Không có giao dịch, email hoặc hợp đồng thật được gửi ra ngoài. Các dịch vụ email, hosting, domain, PostgreSQL đa người dùng và sao lưu cloud chưa được triển khai ở bước này.
