# Các bước chi tiết tạo app bdsgiatot.vn

Mục tiêu bản đầu: website trên điện thoại và máy tính, cổng doanh nghiệp, cổng Sale và trang quản trị nền tảng. Chưa làm ứng dụng iOS/Android riêng. Mỗi bước dưới đây có đầu ra và tiêu chí hoàn thành; không bỏ qua bước phân quyền để làm giao diện trước.

## Bước 1 Chuẩn bị môi trường và cấu hình

1. Cài Node.js bản LTS đang được hỗ trợ đáp ứng yêu cầu của Next.js/Nest CLI; khuyến nghị dòng 24 với bản vá phù hợp. Kiểm tra lại yêu cầu trong tài liệu chính thức trước cài.
2. Cài Docker Desktop và bật backend WSL2 trên Windows, hoặc dùng PostgreSQL/PostGIS do nhà cung cấp quản lý.
3. Mở thư mục `D:\codex\WA_bdsgiatot` bằng VS Code.
4. Giữ nguyên tài liệu Word và hình đã có. Các file mới gồm sql, docs, scripts, tests và compose.yaml.
5. Sao chép cấu hình mẫu rồi thay các chuỗi REPLACE bằng mật khẩu riêng. Dùng mật khẩu khác nhau cho owner/API/auth/worker. Nếu mật khẩu có ký tự đặc biệt, URL-encode phần mật khẩu trong connection string.

```powershell
Set-Location 'D:\codex\WA_bdsgiatot'
Copy-Item -LiteralPath '.env.example' -Destination '.env'
npm ci
```

Không chạy Copy-Item ghi đè `.env` nếu đã có cấu hình. Bộ bàn giao có `package-lock.json`; dùng npm ci để cài đúng phiên bản đã khóa. Không commit `.env`.

**Hoàn thành khi:** Node/npm chạy được, Docker đang hoạt động hoặc có database riêng, các mật khẩu mẫu đã thay.

## Bước 2 Tạo database và chạy SQL

```powershell
docker compose up -d db
docker compose ps
npm run db:migrate
npm run db:roles
```

- `compose.yaml` chỉ mở PostgreSQL trên 127.0.0.1, không đưa database ra internet.
- Migration chạy 001–004 và lưu checksum. File 005 là tham khảo thủ công, không cần chạy khi dùng bootstrap script.
- db:roles tạo ba login runtime và không tự ghi đè login đang có. Chỉ chạy một lần; thay mật khẩu về sau qua quy trình quản trị riêng.
- Nếu dùng database managed: yêu cầu quyền cài PostGIS/pg_trgm, tạo schema và role. Nhà cung cấp có thể yêu cầu tạo extension/role từ dashboard trước; điều chỉnh bootstrap theo quyền được cấp, không bỏ RLS.
- Không chạy `docker compose down -v` trên dữ liệu cần giữ. Volume chứa database không phải bản sao lưu.

**Hoàn thành khi:** 001–004 áp dụng thành công, các role không có SUPERUSER/BYPASSRLS và có thể kết nối riêng.

## Bước 3 Kiểm thử SQL trước khi xây API

```powershell
npm run test:sql
```

Lệnh này tạo database trong bộ nhớ, không sửa database app. Xem `tests/last-result.json`. Sau đó tạo database PostgreSQL riêng có tên kết thúc `_test`, cấu hình `DATABASE_TEST_URL` chỉ tới database thử nghiệm rồi chạy lại để có bài kiểm tra nhiều kết nối.

```powershell
docker compose exec db createdb -U bds_owner bdsgiatot_test
# Đặt DATABASE_TEST_URL trong môi trường shell hoặc file cấu hình riêng, không dùng URL production.
node --env-file=.env.test tests/sql.test.mjs
```

`.env.test` do người triển khai tạo, chứa `DATABASE_TEST_URL=postgresql://.../bdsgiatot_test`. Test native yêu cầu schema bds chưa tồn tại; dùng database test mới cho lần chạy tiếp theo. Không tự động xóa/reset database để chạy lại.

**Hoàn thành khi:** RLS, hạn mức, lời mời, duyệt tin, quyền hết hạn và kiểm thử cạnh tranh slot đều đạt trên PostgreSQL mục tiêu.

## Bước 4 Tạo tài khoản quản trị đầu tiên

Điền BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_NAME trong `.env`, sau đó:

```powershell
npm run db:bootstrap
```

Script hỏi mật khẩu trong terminal và không hiển thị ký tự, hash Argon2id và tạo admin đầu tiên. Script từ chối nếu đã có admin active. Không đưa bootstrap thành một URL HTTP và không giữ DATABASE_ADMIN_URL trong môi trường API/worker khi triển khai.

**Hoàn thành khi:** có đúng người quản trị thực tế, không tồn tại mật khẩu mặc định trong mã nguồn.

## Bước 5 Khởi tạo cấu trúc web và API

Chỉ chạy trên thư mục apps mới, không ghi đè một ứng dụng hiện có:

```powershell
New-Item -ItemType Directory -Path apps -Force
npx create-next-app@latest apps/web --typescript --eslint --app --src-dir --use-npm
npx @nestjs/cli@latest new apps/api --package-manager npm --skip-git
```

Chọn cấu hình module phù hợp với phiên bản Nest CLI hiện tại và giữ nhất quán. Đặt API ở cổng 3001; Next ở 3000. Khi triển khai dùng reverse proxy `/api` về Nest để web và API cùng origin.

```text
apps/
  web/src/app/
    (public)/          trang chủ, mua bán, cho thuê, dự án, tin, nội dung, danh bạ
    (auth)/            đăng nhập, thông báo đăng ký, kích hoạt, đặt lại mật khẩu
    company/           tài khoản Sale, combo, phân công, tin, liên hệ
    sale/              hồ sơ, dự án được giao, tin của tôi, liên hệ của tôi
    admin/             doanh nghiệp, hợp đồng, combo, dự án, duyệt tin, nội dung
  api/src/
    database/ auth/ organizations/ contracts/ subscriptions/
    assignments/ projects/ listings/ media/ moderation/
    contacts/ directory/ content/ search/ seo/
  worker/              tiến trình xử lý outbox, ảnh, hết hạn
```

Route group `(public)` và `(auth)` không xuất hiện trong URL. Đây là cấu trúc đề xuất, chưa phải các thư mục đã sinh trong bộ bàn giao.

**Hoàn thành khi:** web và API khởi động độc lập, API có `/health`, các cấu hình chỉ đọc từ biến môi trường.

## Bước 6 Làm lớp database và xác thực

### Kết nối nghiệp vụ

Tạo pool API từ DATABASE_API_URL. Mỗi request đã xác thực chạy một transaction trên một client. Không dùng nhiều lần `pool.query` riêng lẻ cho cùng transaction.

```ts
async function withActor<T>(userId: string | null, work: (db: PoolClient) => Promise<T>) {
  const db = await apiPool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.user_id', $1, true)", [userId ?? '']);
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); }
}
```

`userId` lấy từ session đã kiểm tra chữ ký và trạng thái, không từ body/header tự khai. `true` làm context tự hết sau transaction, tránh lẫn công ty khi tái sử dụng kết nối.

### Xác thực

1. Đăng nhập bằng email chuẩn hóa và password; auth pool đọc hash, dùng Argon2 verify ở server.
2. Rate limit theo IP/tài khoản, lỗi đăng nhập chung để hạn chế dò email.
3. Session/cookie HttpOnly, Secure ở production, SameSite phù hợp; kiểm tra CSRF cho thao tác thay đổi dữ liệu.
4. Refresh token ngẫu nhiên chỉ lưu hash, xoay vòng khi dùng; khóa hàng token để không dùng lại đồng thời. Thu hồi session khi khóa người dùng hoặc reset mật khẩu.
5. Nút Đăng ký chỉ mở thông báo: “Vui lòng liên hệ công ty phụ trách dự án của bạn để được cấp tài khoản đăng tin trên bdsgiatot.vn.” Không có API tự đăng ký Sale công khai.
6. Lời mời do server tạo token ngẫu nhiên mạnh, lưu SHA-256 hash bằng hàm invite, gửi token gốc qua email riêng. Không ghi token vào log. API kích hoạt gọi `accept_invitation`; user đã có tài khoản phải đăng nhập đúng tài khoản.
7. Reset mật khẩu dùng `user_tokens` purpose=password_reset, hết hạn ngắn, dùng một lần và kiểm tra khóa token trong transaction. Chỉ auth service được đổi credential; không cung cấp một endpoint nhận thẳng hash do trình duyệt gửi.

**Hoàn thành khi:** đăng nhập/kích hoạt/reset hoạt động; token lặp bị từ chối; sửa userId trong request không đổi quyền.

## Bước 7 Làm trang quản trị nền tảng trước

Thứ tự màn hình và thao tác:

1. **Doanh nghiệp:** nhập pháp nhân, mã đăng ký và quốc gia; tải hồ sơ private; duyệt hoặc từ chối.
2. **Dự án:** địa lý, tên, mô tả, ba loại sản phẩm, ảnh mô tả nếu bổ sung; nhập một lần cho cả bán và thuê.
3. **Đơn vị tham gia dự án:** chủ sở hữu/chủ đầu tư/phân phối và trạng thái xác minh.
4. **Hợp đồng:** mã, doanh nghiệp, ngày hiệu lực, ngày ký, tài liệu signed_contract. Đây là nơi nhập hợp đồng đã ký, không tự sinh cam kết pháp lý.
5. **Combo:** mẫu gói, hạn mức Sale, hạn mức tin đồng thời, thời hạn; hạn mức thực tế lưu ở subscriptions.
6. **Quyền dự án:** chọn dự án thuộc công ty theo project_organizations; khoảng hiệu lực nằm trong combo.
7. **Thanh toán:** ghi nhận theo hợp đồng, chống lặp bằng provider/reference. Kích hoạt combo theo điều kiện thanh toán thực tế, không tự giả định chính sách.
8. **Quản trị doanh nghiệp:** gọi provision_org_admin và gửi lời mời; không gửi mật khẩu dùng chung.

Trạng thái verified/active chỉ sửa qua route có guard admin. API sử dụng allowlist trường, không đưa toàn bộ request body vào SQL.

**Hoàn thành khi:** admin cấu hình được một công ty có hợp đồng, combo, dự án và tài khoản quản lý; công ty khác không đọc được tài liệu này.

## Bước 8 Làm cổng doanh nghiệp và cổng Sale

Doanh nghiệp nhìn thấy combo và số suất đã giữ/tổng hạn mức. Bấm mời Sale gọi `invite_sale`, đồng thời giữ suất; gửi email sau khi transaction thành công. Nếu gửi thất bại, cho gửi lại token mới và vô hiệu token cũ, không tạo thêm suất.

Màn hình phân công chọn Sale có suất trong combo → chọn quyền dự án trong combo → gọi assign_project. Khi Sale nghỉ việc, block thành viên; chuyển tin sang Sale khác hoặc revoke_seat để giải phóng suất. Nêu rõ revoke sẽ ẩn các tin đang hoạt động.

Sale chỉ thấy dự án được phân công, tạo tin nháp và cập nhật hồ sơ công khai. Form dự án dùng danh sách server trả về, nhưng server vẫn kiểm tra FK và quyền khi ghi. Mặc định thông tin liên hệ riêng tư không tự trở thành số điện thoại công khai.

**Hoàn thành khi:** một Sale chỉ quản lý tin mình phụ trách; org admin thấy tin công ty; không có cách tự tăng hạn mức hoặc tự nhận dự án.

## Bước 9 Làm tin đăng và kiểm duyệt

1. Form tin gồm dự án được giao, Mua – Bán/Cho thuê, loại sản phẩm, tiêu đề, nội dung, giá/thỏa thuận, tiền tệ, đơn vị giá, diện tích, phòng và ảnh.
2. Gửi upload trực tiếp vào vùng tạm object storage qua URL ký có hạn, kèm giới hạn dung lượng. Backend tạo media processing, worker xác thực và tạo bản ảnh ready.
3. Gắn ảnh ready vào nháp bằng listing_media; ít nhất một ảnh trước duyệt.
4. Sale gửi duyệt bằng transition_listing(...,'pending').
5. Admin xem nội dung và ảnh, chọn ngày hết hạn nằm trong quyền; gọi transition_listing(...,'published',NULL,expires_at).
6. Từ chối phải có lý do. Sửa tin công khai cần ẩn rồi mở nháp và duyệt lại.
7. Giao diện dùng thông báo có nghĩa: hết suất Sale, hết hạn combo, thiếu ảnh, vượt số tin. Không trả chi tiết SQL cho khách.

**Hoàn thành khi:** không thể gửi status=published qua form để tự công khai, ảnh khác công ty bị từ chối và nhật ký có người thao tác.

## Bước 10 Làm website công khai và tìm kiếm

Các trang:

- `/`: thanh tìm kiếm, dự án bán/thuê, doanh nghiệp, tin tức/phân tích.
- `/mua-ban` và `/cho-thue`: thị trường trong/ngoài nước, quốc gia khi ngoài nước, loại sản phẩm và tên dự án.
- `/du-an/[slug]`: hồ sơ duy nhất và danh sách tin phù hợp.
- `/tin/[slug]-[publicCode]`: nội dung, ảnh, doanh nghiệp/Sale và yêu cầu liên hệ.
- `/doanh-nghiep/[slug]`, `/moi-gioi/[slug]`.
- `/tin-tuc/[slug]`, `/phan-tich-thi-truong/[slug]`.

Kết quả tìm kiếm chính là dự án; dùng EXISTS hoặc GROUP BY trên public_listings và áp dụng toàn bộ điều kiện lọc trước khi đếm. Trong dự án có lọc giá, diện tích. Nếu chưa chọn tiền tệ/đơn vị giá, không sắp xếp giá lẫn VND/USD hay tháng/năm.

Form liên hệ không cần tài khoản, nhưng phải có đồng ý cung cấp liên hệ, rate limit và chống spam. Gọi record_contact; công ty và Sale phụ trách xem được qua RLS. Liên hệ công khai của tin lấy public_listing_contacts; không lấy email đăng nhập từ users.

**Hoàn thành khi:** tìm đúng tổ hợp loại giao dịch–loại sản phẩm–thị trường, tin hết quyền không còn xuất hiện và không lộ dữ liệu khách.

## Bước 11 Làm nội dung SEO và worker

### Nội dung và SEO

Chỉ có news và market_analysis. Tài khoản editor được biên tập nội dung, không duyệt combo/tin Sale. Làm metadata, canonical, breadcrumb, ảnh chia sẻ, sitemap; chỉ đưa URL chuẩn có nội dung công khai vào sitemap. Tránh lập chỉ mục hàng loạt URL bộ lọc. Trang tài khoản/admin noindex và bắt buộc xác thực.

Tin hết hạn cần lựa chọn rõ: trang trạng thái có giá trị thông tin hoặc 404/410 khi gỡ; không redirect tất cả về trang chủ. Thời gian, nguồn dữ liệu và tác giả phân tích phải hiển thị rõ. Schema JSON-LD phải phản ánh nội dung thực, không cam kết thứ hạng.

### Worker

- Chạy expire_listings theo lô; số tin công khai vẫn được kiểm tra thời hạn ngay tại query.
- Lấy outbox bằng `FOR UPDATE SKIP LOCKED`; tác vụ xử lý theo kiểu có thể nhận lặp. Dùng event id để chống xử lý trùng.
- Đánh dấu processed_at sau thành công; thất bại tăng attempts, đặt available_at để retry và ghi last_error đã lọc thông tin nhạy cảm.
- Ảnh cần cơ chế quét media processing hoặc phát sự kiện upload hoàn tất ở API. Outbox hiện có sự kiện thay đổi tin, phạm vi quyền và yêu cầu liên hệ.
- Nếu xử lý tác vụ dài: bổ sung lease/claim và thời hạn lease thay vì giữ transaction database trong lúc gửi email hoặc nén ảnh. Bản đầu có thể khóa theo lô ngắn cho tác vụ nhanh.
- Gửi email sau commit; không gửi ngay trong transaction đang giữ khóa combo. Không tự gửi thông báo khách khi chưa có yêu cầu nghiệp vụ.

**Hoàn thành khi:** worker khởi động lại không làm nhân đôi tác dụng, log lỗi có thể tra cứu và không làm chậm gửi tin.

## Bước 12 Nghiệm thu và triển khai

1. Dùng môi trường staging có hai công ty để thử cách ly, hết hạn, khóa Sale, lời mời và quota đồng thời.
2. Chạy test HTTP, trình duyệt trên điện thoại, kiểm tra HTML SEO, lỗi 404, URL canonical, ảnh và form liên hệ.
3. Đo truy vấn chậm và tải mô phỏng với dữ liệu gần quy mô dự kiến. Chỉ bổ sung Redis/tìm kiếm riêng khi có số liệu.
4. Build web/API/worker; triển khai gần database. Backend database chỉ mở mạng riêng.
5. Cấu hình domain, HTTPS, CDN cho ảnh và tệp tĩnh, reverse proxy `/api`, CORS/CSRF, cookies và mail.
6. Tạo bucket private cho hợp đồng; route tải tạo URL ký sau xác thực quyền.
7. Tách runtime secrets: web không có DB password; API chỉ API/auth pools; worker chỉ worker pool; migration dùng quyền owner riêng khi triển khai.
8. Sao lưu database và object storage độc lập. Thử phục hồi trước mở thật; chốt mức mất dữ liệu và thời gian phục hồi chấp nhận được.
9. Theo dõi lỗi đăng nhập, lỗi gửi tin, pool connections, dung lượng, truy vấn chậm, tuổi sự kiện outbox và uptime.
10. Phát hành một nhóm doanh nghiệp thử trước; có bản ứng dụng trước đó để rollback. Với database, dùng migration bổ sung, không tự chạy DROP để quay lui.

**Hoàn thành khi:** các mục nghiệm thu trong docs/04-kiem-thu.md đạt, phục hồi thử thành công và chủ hệ thống đã nhập dữ liệu doanh nghiệp/dự án thực.

## Nguồn triển khai

- Next.js: https://nextjs.org/docs/app/getting-started/installation
- NestJS: https://docs.nestjs.com/first-steps
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Docker PostGIS: https://hub.docker.com/r/postgis/postgis
- PGlite và giới hạn một kết nối: https://pglite.dev/docs/
