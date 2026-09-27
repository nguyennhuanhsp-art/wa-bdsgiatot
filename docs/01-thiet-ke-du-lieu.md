# Thiết kế dữ liệu bdsgiatot.vn

## 1 Quyết định chuyển từ ERD sang SQL

SQL triển khai mô hình doanh nghiệp → hợp đồng → combo → quyền dự án → suất tài khoản → phân công → tin đăng. `organization_id`, `project_id`, `subscription_id` được lặp ở một số bảng nhằm tạo khóa ngoại ghép kiểm tra tính nhất quán. Đây là dữ liệu có ràng buộc, không phải bản sao được nhập tùy ý.

### Điều chỉnh có chủ đích

- Thêm `subscription_seats`: một thành viên Sale chiếm một suất trong mỗi combo được cấp. Một Sale làm nhiều dự án trong cùng combo chỉ chiếm một suất; làm dự án trong hai combo phải được cấp suất ở cả hai. Lời mời chưa kích hoạt vẫn giữ suất để tránh vượt hạn mức. Org admin quản lý không chiếm suất Sale; nếu trực tiếp đăng tin thì tạo tin cho phân công Sale hợp lệ.
- `users` không lưu mật khẩu. Hash Argon2id nằm trong `bds_private.auth_credentials` và chỉ auth pool được đọc.
- Thêm `invitation_tokens` và `user_tokens` để hỗ trợ lời mời, reset mật khẩu và refresh token. Chỉ lưu hash token, không lưu token gốc.
- Loại sản phẩm dùng mã cố định, không cần thêm UUID trung gian. Khóa ghép `project_id + property_type_code` bảo đảm tin không có loại sản phẩm ngoài dự án.
- Dự án là hồ sơ dùng chung, không nhân đôi khi vừa bán vừa cho thuê. Bản đầu chưa có bảng xác định từng căn/thửa đất thực tế: mỗi `listing` là một quảng cáo. Có thể bổ sung `properties` khi nghiệp vụ quản lý kho căn phát sinh.
- Địa lý quốc tế dùng `country_code` và cây `locations`, không bắt mọi quốc gia dùng tỉnh/huyện/phường Việt Nam. `location_mappings` hỗ trợ sáp nhập/chia tách; alias dùng cho tên gọi khác.

## 2 Nhóm dữ liệu

| Nhóm | Bảng |
|---|---|
| Địa lý và danh mục | countries, currencies, locations, location_aliases, location_mappings, property_types |
| Tài khoản | users, organization_members, agent_profiles; auth_credentials, user_tokens, invitation_tokens trong schema riêng |
| Doanh nghiệp | organizations, organization_documents, project_organizations |
| Thương mại | contracts, contract_documents, payment_records, combo_plans, subscriptions, subscription_projects, subscription_seats |
| Sản phẩm | projects, project_property_types, project_assignments, listings |
| Nội dung tin | media_assets, listing_media, listing_revisions, moderation_actions |
| Khách hàng | contact_requests |
| Biên tập và SEO | articles, article_projects, seo_pages, redirects |
| Vận hành | audit_logs, outbox_events |

DDL là từ điển trường chính thức. Thời gian dùng `timestamptz`, lưu dưới dạng thời điểm tuyệt đối và hiển thị Asia/Ho_Chi_Minh hoặc múi giờ của dự án. Tiền và diện tích dùng `numeric`, không dùng float. Ngày kết thúc quyền là mốc loại trừ: `now < ends_at`.

## 3 Ràng buộc doanh nghiệp và dự án

`subscriptions(contract_id, organization_id)` tham chiếu `contracts(id, organization_id)`. `subscription_projects` cùng lúc tham chiếu combo và quan hệ doanh nghiệp–dự án bằng khóa ngoại ghép. Suất tài khoản tham chiếu thành viên thuộc cùng doanh nghiệp; phân công kết nối suất với quyền dự án thuộc cùng combo. Tin đăng tham chiếu phân công bằng bốn trường id/doanh nghiệp/dự án/combo.

Do đó, thay UUID tổ chức trong request không thể gắn tin của công ty A sang quyền dự án của công ty B. Các khóa phạm vi không được đổi sau khi tạo. Chuyển người phụ trách dùng `transfer_listing`, chỉ trong cùng doanh nghiệp, dự án và combo. Chuyển sang combo khác cần luồng gia hạn/chuyển gói được phát triển riêng; không sửa FK thủ công.

## 4 Hiệu lực combo và hạn mức

Quyền công khai phải đồng thời thỏa mãn:

1. Doanh nghiệp hoạt động và đã xác minh.
2. Hợp đồng active, có ngày ký, trong thời hạn và có tài liệu signed_contract.
3. Combo active và trong thời hạn.
4. Quan hệ doanh nghiệp–dự án verified; hồ sơ dự án published.
5. Quyền dự án active và trong thời hạn.
6. Suất, phân công và thành viên active; tài khoản Sale active.
7. Tin published và chưa hết hạn.

`public_listings` kiểm tra các điều kiện này khi đọc. Vì vậy worker chạy chậm không làm tin đã hết quyền xuất hiện qua truy vấn mới. Việc ký hợp đồng hay đánh dấu verified là quyết định có kiểm soát của nền tảng; SQL không chứng minh tính pháp lý của tài liệu.

`allocate_seat` và `transition_listing(...,'published',...)` cập nhật `quota_revision` để khóa hàng combo trước khi đếm và cấp suất. Ở mức cô lập cao hơn READ COMMITTED, giao dịch có thể nhận lỗi serialization; API phải retry có giới hạn. Các thay đổi trực tiếp vào trạng thái đăng hoặc bảng suất không được cấp quyền cho API runtime.

Suất active vẫn được giữ khi Sale bị block; doanh nghiệp gọi `revoke_seat` để giải phóng. Tin published còn thời hạn vẫn chiếm hạn mức cho đến khi ẩn/đóng/hết hạn, dù đang tạm bị chặn công khai bởi điều kiện cấp trên. Chính sách này tránh tự tái xuất bản vượt hạn mức sau khi mở khóa.

## 5 Trạng thái tin và ảnh

```text
draft / rejected -> pending -> published
                         -> rejected (phải có lý do)
pending / published -> hidden
hidden / expired / rejected -> draft -> gửi duyệt lại
published / hidden / expired -> closed
published -> expired (worker)
```

Chỉ admin nền tảng được duyệt hoặc từ chối. Sale và quản trị doanh nghiệp được gửi duyệt, ẩn, mở lại nháp hoặc đóng tin trong phạm vi quyền. Muốn sửa nội dung hoặc ảnh đã công khai phải ẩn → mở nháp → sửa → gửi duyệt lại. Tối thiểu một ảnh ready trước khi công khai.

Ảnh phải cùng doanh nghiệp với tin. API chỉ tạo ảnh processing; worker xác nhận ảnh thực, quét/giới hạn kích thước, loại metadata không cần thiết, sinh bản WebP/AVIF rồi đánh dấu ready. `public_url` chỉ dành cho ảnh quảng cáo; hợp đồng không đi qua `media_assets`.

## 6 Phân quyền database

| Role nhóm NOLOGIN | Mục đích |
|---|---|
| bdsgiatot_api | API nghiệp vụ; có RLS, đọc view công khai, gọi các hàm kiểm soát |
| bdsgiatot_auth | Xác thực phía máy chủ; đọc hash, quản lý token, chấp nhận lời mời |
| bdsgiatot_worker | Xử lý ảnh, outbox và hết hạn tin |

Ba login riêng được tạo bằng `scripts/provision-logins.mjs`. Tài khoản chạy migration là chủ schema, không dùng để chạy API. Superuser và chủ bảng có thể bỏ qua RLS; đây là lý do bắt buộc tách login.

Backend xác minh session trước, sau đó đặt `app.user_id` bằng `set_config(..., true)` trong transaction trên đúng một kết nối. Không nhận user ID hoặc role từ JSON của client làm nguồn tin cậy. Không cho browser truy cập PostgreSQL/PostgREST trực tiếp bằng cơ chế này: tài khoản database có thể tự đặt custom GUC; RLS ở đây bảo vệ truy vấn của backend tin cậy, không thay thế xác thực.

Auth pool có quyền nhạy cảm và không dùng cho truy vấn nghiệp vụ. Hạn chế route và service được phép sử dụng pool này. Token chấp nhận lời mời cho user đã active còn yêu cầu session đúng user; user mới được kích hoạt bằng token còn hạn và mật khẩu đã hash.

## 7 SEO và tìm kiếm

`public_projects` chỉ có dự án đang có ít nhất một tin công khai hợp lệ. Bộ lọc kết quả dự án phải được áp dụng trên cùng tập `public_listings`, không lấy tên dự án từ một truy vấn rồi đếm loại giao dịch ở truy vấn khác.

Giá phải so sánh cùng tiền tệ và đơn vị. Thuê dùng per_month/per_year, bán dùng total/per_m2. Không dùng NULL làm giá 0. Khi `negotiable=true`, `price_amount` bắt buộc NULL; khi false, giá phải dương.

`pg_trgm` hỗ trợ tìm tên dự án bằng ILIKE và gợi ý gần đúng. Chuẩn hóa tìm không dấu tiếng Việt có thể bổ sung ở bước tìm kiếm; không tuyên bố schema hiện tại tự bỏ dấu. Index địa lý PostGIS đã có cho nhu cầu bản đồ sau này.

Canonical, robots, sitemap, nội dung HTML và dữ liệu có cấu trúc thuộc layer ứng dụng. SQL lưu dữ liệu và cấu hình; chỉ lưu meta_title không tự tạo SEO cho website.

## 8 Phần cần hoàn thiện ở layer ứng dụng

- Rate limit, CSRF, cookie/session, mật khẩu, email, xác minh quyền truy cập URL tài liệu.
- Chặn cây địa lý có chu trình; kiểm tra redirect vòng lặp và URL đích nội bộ.
- Kiểm tra nội dung HTML an toàn, ảnh đúng loại; chống tin trùng và spam.
- Luồng gia hạn, chuyển gói, điều chỉnh khoảng thời gian hợp đồng và phân công hàng loạt.
- Chỉ kích hoạt combo theo điều kiện thanh toán đã thỏa thuận; không giả định luôn phải thanh toán 100% trước.
- Không cache dùng chung nội dung tài khoản. MVP dùng no-store cho dữ liệu tin và quyền; chỉ cache ảnh/tệp tĩnh. Khi bổ sung cache trang, cần hết hạn theo quyền và vô hiệu hóa theo sự kiện, tránh hiển thị tin vừa bị khóa.
- Sao lưu, retention dữ liệu liên hệ, giám sát lỗi và kiểm tra phục hồi.

## Nguồn kỹ thuật

- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Khóa và ràng buộc: https://www.postgresql.org/docs/current/ddl-constraints.html
- Khóa giao dịch: https://www.postgresql.org/docs/current/explicit-locking.html
- PostGIS: https://postgis.net/documentation/getting_started/
