# API và ma trận phân quyền

API đề xuất dùng tiền tố `/api/v1`. Đây là hợp đồng thiết kế để xây controller/service, chưa phải các endpoint đang chạy. Mọi mutation dùng transaction, truy vấn tham số và allowlist trường. Không trả nguyên hàng database nếu có cột nội bộ.

## 1 Ma trận quyền

| Thao tác | Khách | Sale | Quản trị công ty | Admin nền tảng | Editor |
|---|---|---|---|---|---|
| Xem dự án/tin công khai | Có | Có | Có | Có | Có |
| Gửi yêu cầu liên hệ | Có, chống spam | Có | Có | Có | Có |
| Tự đăng ký để đăng tin | Không | Không | Không | Không | Không |
| Cấp combo, sửa hạn mức | Không | Không | Không | Có | Không |
| Xác minh doanh nghiệp/dự án | Không | Không | Không | Có | Không |
| Mời Sale và phân công | Không | Không | Trong công ty | Có | Không |
| Tạo/sửa nháp | Không | Phân công của mình | Phân công công ty | Có | Không |
| Gửi duyệt/ẩn tin | Không | Tin phụ trách | Tin công ty | Có | Không |
| Duyệt/từ chối | Không | Không | Không | Có | Không |
| Xem khách liên hệ | Không | Tin phụ trách | Tin công ty | Có | Không |
| Đọc hợp đồng | Không | Không | Công ty mình | Có | Không |
| Viết tin tức/phân tích | Không | Không | Không | Có | Có |

Admin của công ty không tự cấp thêm admin công ty trong bản đầu. Admin nền tảng cấp tài khoản quản lý doanh nghiệp qua `provision_org_admin`. Phân quyền của một tài khoản có thể khác nhau ở từng tổ chức; luôn chọn và xác minh ngữ cảnh doanh nghiệp ở backend.

## 2 Nhóm xác thực

| Method và route | Hành vi |
|---|---|
| POST /auth/login | Verify hash, kiểm tra trạng thái, tạo session |
| POST /auth/refresh | Xoay token và chống replay trong transaction |
| POST /auth/logout | Thu hồi refresh token/session |
| POST /auth/invitations/accept | Hash token nhận được; gọi accept_invitation bằng auth pool |
| POST /auth/password/forgot | Phản hồi chung; tạo token ngắn hạn nếu email hợp lệ |
| POST /auth/password/reset | Khóa và tiêu thụ token; đổi hash; thu hồi refresh tokens |
| GET /me | Hồ sơ tài khoản và tổ chức đã được cấp |

Không tạo POST /auth/register. Web vẫn có nút Đăng ký để hiển thị thông báo liên hệ công ty.

## 3 Quản trị và thương mại

| Method và route | Bảng hoặc hàm |
|---|---|
| POST/PATCH /admin/organizations | organizations |
| POST /admin/organizations/:id/documents | organization_documents; storage private |
| POST /admin/organizations/:id/admin-invitations | provision_org_admin |
| POST/PATCH /admin/projects | projects + project_property_types |
| POST/PATCH /admin/project-organizations | project_organizations |
| POST/PATCH /admin/contracts | contracts |
| POST /admin/contracts/:id/documents | contract_documents |
| POST /admin/contracts/:id/payments | payment_records, reference chống lặp |
| POST/PATCH /admin/combo-plans | combo_plans |
| POST/PATCH /admin/subscriptions | subscriptions |
| POST/PATCH /admin/subscription-projects | subscription_projects |
| GET /company/subscriptions | Chỉ công ty mình qua RLS |
| GET /company/contracts | Chỉ công ty mình; tải tài liệu qua URL ký |

Nếu nhận webhook thanh toán, xác minh chữ ký và chống replay trước ghi dữ liệu. Payment success không mặc định auto-activate combo; nghiệp vụ kích hoạt theo hợp đồng. Mọi reference phải xác định duy nhất trong provider.

## 4 Thành viên và phân công

| Method và route | Hàm/cách xử lý |
|---|---|
| GET /company/members | organization_members và users được phép |
| POST /company/sale-invitations | invite_sale(subscription_id,email,display_name,token_hash,expires_at) |
| POST /company/seats | allocate_seat(subscription_id,member_id) |
| POST /company/seats/:id/revoke | revoke_seat(seat_id) |
| PATCH /company/members/:id/status | set_sale_status(member_id,status) |
| POST /company/assignments | assign_project(seat_id,subscription_project_id) |
| POST /company/listings/:id/transfer | transfer_listing(listing_id,new_assignment_id) |
| GET /sale/assignments | Chỉ phân công của Sale hiện tại |

Lời mời email đã là thành viên Sale active có thể cấp thêm suất ở combo mới. Lời mời mới cho tài khoản đã tồn tại ở công ty khác vẫn cần người đó chấp nhận; không đổi mật khẩu tài khoản cũ.

## 5 Tin đăng và ảnh

| Method và route | Hàm/cách xử lý |
|---|---|
| GET /listings/mine | Bảng listings với RLS; query phân trang |
| POST /listings | INSERT nháp; created_by lấy từ actor, không từ client |
| PATCH /listings/:id | Chỉ cột nội dung; trạng thái draft/rejected |
| POST /listings/:id/submit | transition_listing(id,'pending') |
| POST /listings/:id/hide | transition_listing(id,'hidden') |
| POST /listings/:id/reopen | transition_listing(id,'draft') |
| POST /listings/:id/close | transition_listing(id,'closed') |
| POST /admin/listings/:id/approve | transition_listing(id,'published',NULL,expires_at) |
| POST /admin/listings/:id/reject | transition_listing(id,'rejected',reason) |
| POST /media/upload-url | Xác thực phạm vi, URL upload ngắn hạn vào vùng tạm |
| POST /media/:id/complete | Xác nhận object đúng key và kích thước; xếp xử lý ảnh |
| POST/DELETE /listings/:id/media | listing_media, phải nháp/rejected |

Không nhận trực tiếp `organization_id`, `subscription_id` từ client mà không đối chiếu assignment. Cách tốt nhất là lấy các trường phạm vi từ assignment server đã đọc và kiểm tra, rồi insert; FK tiếp tục bảo vệ ở database.

## 6 Công khai

| Method và route | Nguồn dữ liệu |
|---|---|
| GET /public/projects | public_projects kết hợp public_listings để lọc |
| GET /public/projects/:slug | Hồ sơ và tin hợp lệ |
| GET /public/listings/:publicCode | public_listings, public_listing_media, public_listing_contacts |
| POST /public/listings/:id/contact | record_contact; bắt buộc rate limit/consent |
| GET /public/organizations | public_organizations |
| GET /public/agents | public_agents |
| GET /public/articles | public_articles; category=news hoặc market_analysis |
| GET /public/catalogs | countries, currencies, property_types, locations được phép |

Không mở endpoint trả query SQL tự do. View công khai chỉ được truy cập qua backend. Cache của API nội dung tin ở bản đầu dùng no-store để quyền đình chỉ có tác dụng ngay trên các lượt đọc mới.

## 7 Ví dụ truy vấn tìm dự án

Tham số `$1...$5` lần lượt: sale/rent; domestic/international hoặc NULL; country ISO hoặc NULL; loại sản phẩm hoặc NULL; từ khóa hoặc NULL. `$6` là số dòng tối đa đã chặn 1–50; `$7` là offset đã kiểm tra không âm.

```sql
SELECT p.id, p.name, p.slug, p.address, p.country_code,
       count(l.id)::int AS matching_listing_count
FROM bds.public_projects p
JOIN bds.public_listings l ON l.project_id=p.id
WHERE l.transaction_type=$1
  AND ($2::text IS NULL OR l.market_scope=$2)
  AND ($3::char(2) IS NULL OR l.country_code=$3)
  AND ($4::text IS NULL OR l.property_type_code=$4)
  AND ($5::text IS NULL OR p.name ILIKE '%' || $5 || '%')
GROUP BY p.id,p.name,p.slug,p.address,p.country_code
ORDER BY count(l.id) DESC,p.id
LIMIT $6 OFFSET $7;
```

Tổng số dự án cho phân trang phải dùng đúng cùng bộ lọc. Giai đoạn đầu offset đơn giản; khi dữ liệu lớn chuyển keyset pagination với thứ tự ổn định. Không tổng hợp giá đa tiền tệ hoặc đa đơn vị trong cùng một min/max.

## 8 Mã lỗi cho giao diện

| Tình huống | HTTP đề xuất |
|---|---|
| Chưa đăng nhập/session hết hạn | 401 |
| Không có quyền | 403; hoặc 404 nếu cần tránh lộ sự tồn tại đối tượng |
| Không thấy bản ghi trong phạm vi quyền | 404 |
| Hết quota, trạng thái xung đột, reference trùng | 409 |
| Nội dung thiếu, giá không hợp lệ, thiếu ảnh | 422 |
| Quá nhiều yêu cầu | 429 |

SQLSTATE 23514 bao gồm nhiều lỗi nghiệp vụ; service map thông điệp/mã nội bộ có kiểm soát, không đưa nguyên lỗi database ra web. Lỗi 40001/40P01 cần retry có giới hạn với backoff, không retry các bước gửi email/thanh toán ngoài transaction một cách mù quáng.
