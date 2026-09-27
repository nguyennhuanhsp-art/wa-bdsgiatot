# Dùng Cursor và cập nhật vào hệ thống của khách

Ngày hướng dẫn: 25/09/2026.

## 1 Xác định đúng thứ đang dùng

Cursor giúp đọc/sửa mã nguồn, chạy lệnh và kiểm thử. Để website hoạt động cho người dùng vẫn cần môi trường chạy ứng dụng và database. Việc khách đang dùng Cursor chưa cho biết họ đang lưu website/database ở đâu. Ưu tiên tận dụng mã nguồn, hosting và database hiện có sau khi kiểm tra tương thích; chưa cần mua thêm dịch vụ.

Thư mục D:\codex\WA_bdsgiatot hiện có bộ thiết kế database và hướng dẫn. Đây chưa phải mã nguồn website hoàn chỉnh của khách. Không coi package.json trong bộ này là cấu hình ứng dụng của khách.

Thông tin cần lấy từ khách:

- Link kho mã nguồn hoặc đường dẫn thư mục chứa app và nhánh đang triển khai.
- Cách cấp quyền cộng tác bằng tài khoản của chị; không cần chia sẻ mật khẩu tài khoản cá nhân.
- Tên nhà cung cấp hosting, database, môi trường thử nghiệm và cách cập nhật đang sử dụng.
- Website/database đã có dữ liệu thật hay chưa.

Không dán mật khẩu database, file .env thật hoặc token vào chat. Chỉ cần tên dịch vụ và thông tin cấu trúc đã bỏ bí mật.

## 2 Cài và mở Cursor

1. Tải bản Windows từ https://cursor.com/downloads và đăng nhập bằng tài khoản được phép dùng.
2. Chọn File > Open Folder.
3. Nếu học và xem bộ thiết kế: mở D:\codex\WA_bdsgiatot.
4. Nếu cập nhật app khách đã có: mở thư mục mã nguồn của khách. Nếu họ dùng GitHub/GitLab hoặc hệ thống Git khác, nhận quyền trước rồi clone đúng repository về máy.
5. Mở README và package.json để nhận diện nội dung. Bấm Ctrl+I để mở Agent; dùng @ để chỉ định file hoặc thư mục cần tham khảo.
6. Với công việc lớn, dùng Plan Mode để Cursor khảo sát và lập kế hoạch trước khi viết mã. Xem các thay đổi trong diff và chạy kiểm tra trước khi đưa lên hệ thống.

Không cần mua thêm gói chỉ để làm theo hướng dẫn này; khả năng AI và hạn mức thực tế phụ thuộc tài khoản đang sử dụng. Dùng việc nhỏ theo từng module để dễ kiểm tra và giảm số lần phải làm lại.

## 3 Nếu khách đã có app

Đưa riêng thư mục tài liệu/SQL vào một vị trí tham khảo, ví dụ docs/bdsgiatot-blueprint. Không chép đè package.json, lockfile, cấu hình Docker hoặc .env của app khách bằng file cùng tên trong bộ thiết kế.

### Prompt khảo sát ban đầu

```text
Hãy khảo sát mã nguồn dự án đang mở. Xác định frontend, backend, database, cơ chế đăng nhập, migration, cách chạy local, test và deploy từ bằng chứng trong repository. Chỉ báo tên biến môi trường, không đọc hoặc in giá trị bí mật. Phân biệt phần đã xác minh và phần chưa rõ. Chưa sửa mã nguồn hoặc chạy migration/deploy. Cho tôi biết cần đọc những file nào trước khi tích hợp mô hình doanh nghiệp, combo dự án và tài khoản Sale.
```

### Prompt lập kế hoạch tích hợp

```text
Dựa trên kết quả khảo sát và bộ tài liệu bdsgiatot-blueprint, lập kế hoạch cập nhật app hiện tại để hỗ trợ doanh nghiệp ký hợp đồng, combo dự án, cấp suất Sale, phân công, đăng tin và kiểm duyệt. Giữ stack và quy trình triển khai hiện có nếu đáp ứng được. So sánh schema hiện tại với SQL tham khảo; đánh dấu bảng/cột có thể tái sử dụng, phần cần bổ sung, cách chuyển dữ liệu cũ và cách phục hồi. Không áp dụng các file tạo database mới vào database hiện hữu. Chia công việc thành từng thay đổi nhỏ có tiêu chí nghiệm thu.
```

### Thực hiện theo từng phần

Tạo nhánh làm việc riêng sau khi kiểm tra trạng thái Git. Giữ các thay đổi đang có của khách. Không mặc định push vào nhánh đang tự động deploy production. Làm theo thứ tự:

1. Migrations bổ sung và cách ly doanh nghiệp.
2. Xác thực, lời mời và phân quyền.
3. Hợp đồng, combo, suất Sale và phân công.
4. Tin đăng, ảnh và kiểm duyệt.
5. Giao diện dự án, bán/thuê, tìm kiếm và danh bạ.
6. Tin tức, phân tích, SEO và tác vụ nền.

Mỗi phần chạy lại kiểm tra phù hợp trước khi chuyển sang phần kế tiếp. Nếu app hiện tại dùng MySQL hoặc cơ chế đăng nhập khác, phải chuyển thiết kế tương ứng, không chạy SQL PostgreSQL trực tiếp và không tự thay toàn bộ stack.

## 4 Nếu khách chưa có app

Mở D:\codex\WA_bdsgiatot và dùng prompt sau:

```text
Đọc README.md, docs/01-thiet-ke-du-lieu.md, docs/02-tao-app.md và docs/03-api-va-phan-quyen.md. Xác nhận đây là bộ thiết kế database, chưa có web/API. Kiểm tra môi trường máy, lập kế hoạch tạo app local theo từng module. Ưu tiên tận dụng dịch vụ khách đã có; chưa tạo dịch vụ trả phí hoặc deploy. Bước đầu khởi tạo cấu trúc app, cấu hình mẫu và kết nối database phát triển riêng; không dùng database production. Giữ nguyên tài liệu và SQL đã có, không ghi đè file cấu hình hiện hữu.
```

Sau khi có kế hoạch đúng, cho Agent thực hiện từng bước trong docs/02-tao-app.md. Để thử local có thể dùng Docker như hướng dẫn; không bắt buộc mua database cloud ngay.

## 5 Cập nhật lên hệ thống khách

Cursor là công cụ thực hiện thay đổi, còn nơi nhận bản cập nhật là repository và hosting của khách. Trình tự:

1. Xác minh repository, nhánh và cơ chế auto-deploy đang liên kết.
2. Chạy app và migrations trên database thử nghiệm riêng; dữ liệu mẫu hoặc bản sao đã loại thông tin nhạy cảm.
3. Chạy test/build, xem diff và kiểm tra cách ly công ty, hạn mức, tin hết quyền.
4. Đưa thay đổi lên nhánh làm việc; dùng bản xem trước hoặc staging nếu khách có sẵn. Push mã nguồn không phải lúc nào cũng chỉ lưu code: một số nhánh có thể kích hoạt deploy tự động.
5. Chuẩn bị backup đã thử phục hồi, migration bổ sung và bản ứng dụng có thể quay lại. Giữ tương thích giữa code cũ/mới trong quá trình chuyển đổi nếu triển khai nhiều bước.
6. Triển khai theo quy trình sẵn có của khách, chạy migration đúng môi trường và kiểm tra sau cập nhật: đăng nhập, tìm dự án, đăng/duyệt tin và gửi liên hệ.

Prompt dùng ở bước chuẩn bị phát hành:

```text
Kiểm tra diff, test và build của thay đổi này. Từ cấu hình repository, xác định nhánh nào kích hoạt deploy và môi trường nào sẽ nhận bản cập nhật. Chuẩn bị hướng dẫn triển khai theo hạ tầng hiện có, danh sách biến môi trường chỉ gồm tên, migration bổ sung, kiểm tra sau deploy và phương án phục hồi. Nêu rõ thao tác nào tác động database thật. Chưa push vào nhánh production hoặc chạy migration production trong bước chuẩn bị này.
```

Không cần đổi hosting/database chỉ vì đổi công cụ lập trình sang Cursor. Chỉ cân nhắc chuyển dịch vụ khi kiểm tra cho thấy hạ tầng hiện tại không đáp ứng yêu cầu.

## Nguồn chính thức

- Bắt đầu sử dụng: https://cursor.com/docs/get-started/quickstart
- Mở thư mục, Agent và tham chiếu file: https://prod.cursor.com/help/getting-started/first-project
- Quy tắc dự án: https://cursor.com/docs/rules
- Phạm vi file bỏ qua: https://cursor.com/docs/reference/ignore-file

Lưu ý: .cursorignore không thay thế phân quyền hệ thống; không coi đó là cách bảo vệ tuyệt đối bí mật trước các công cụ terminal hoặc dịch vụ tích hợp.
