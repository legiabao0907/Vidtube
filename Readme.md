# VidTube Backend API

Đây là một dự án backend hoàn chỉnh và phức tạp cho một nền tảng chia sẻ video (tương tự như YouTube). Dự án được xây dựng bằng **Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, Multer, và Cloudinary**.

Nền tảng này bao gồm đầy đủ các tính năng như xác thực người dùng, tải video lên, thích, không thích, bình luận, trả lời bình luận, đăng ký kênh, lịch sử xem video của người dùng, và danh sách phát (playlists).

##  Công nghệ sử dụng
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database (Cơ sở dữ liệu):** MongoDB & Mongoose
- **File Upload & Media Storage (Lưu trữ file & media):** Multer & Cloudinary
- **Authentication & Security (Xác thực & Bảo mật):** JWT (Access & Refresh Tokens), bcrypt
- **Khác:** CORS, cookie-parser

---

##  Tham khảo các API Endpoints

Dưới đây là danh sách đầy đủ tất cả các routes.
**Base URL:** `http://localhost:8000/api/v1`

###  Routes Người Dùng (`/users`) ok
- `POST /register` - Đăng ký người dùng mới (nhận `avatar` và `coverImage` qua FormData)
- `POST /login` - Đăng nhập
- `POST /logout` - Đăng xuất (Bảo mật - Cần đăng nhập)
- `POST /refresh-token` - Làm mới Access Token bằng Refresh Token
- `POST /change-password` - Đổi mật khẩu (Bảo mật)
- `GET /current-user` - Lấy thông tin người dùng hiện tại (Bảo mật)
- `PATCH /update-account` - Cập nhật thông tin tài khoản (Bảo mật)
- `PATCH /avatar` - Cập nhật ảnh đại diện (Bảo mật, FormData)
- `PATCH /cover-image` - Cập nhật ảnh bìa (Bảo mật, FormData)
- `GET /c/:username` - Lấy thông tin kênh & số lượng người đăng ký (Bảo mật)
- `GET /history` - Lấy lịch sử xem video của người dùng (Bảo mật)

###  Routes Video (`/videos`) ok
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `GET /` - Lấy tất cả video (Hỗ trợ tìm kiếm `query`, `filter`, `sort`, và phân trang `pagination`)
- `POST /` - Đăng video mới (Tải lên `videoFile` & `thumbnail` qua FormData)
- `GET /:videoId` - Lấy chi tiết video theo ID (Tăng lượt xem)
- `PATCH /:videoId` - Cập nhật thông tin video (tiêu đề, mô tả) & ảnh thu nhỏ (thumbnail)
- `DELETE /:videoId` - Xóa video (Xóa khỏi Database và Cloudinary)
- `PATCH /toggle/publish/:videoId` - Bật/tắt trạng thái công khai của video (Public/Private)

###  Routes Bình Luận (`/comments`) ok
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `GET /:videoId` - Lấy tất cả bình luận của một video cụ thể
- `POST /:videoId` - Thêm bình luận mới cho video
- `PATCH /c/:commentId` - Cập nhật bình luận
- `DELETE /c/:commentId` - Xóa bình luận

###  Routes Lượt Thích (`/likes`) ok
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `POST /toggle/v/:videoId` - Thích/Bỏ thích một video
- `POST /toggle/c/:commentId` - Thích/Bỏ thích một bình luận
- `POST /toggle/t/:tweetId` - Thích/Bỏ thích một bài viết (tweet)
- `GET /videos` - Lấy danh sách tất cả video đã thích của người dùng hiện tại

###  Routes Bài Viết / Cộng Đồng (`/tweets`) ok
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `POST /` - Tạo bài viết cộng đồng mới (tweet)
- `GET /user/:userId` - Lấy tất cả bài viết của một người dùng cụ thể
- `PATCH /:tweetId` - Cập nhật bài viết
- `DELETE /:tweetId` - Xóa bài viết

###  Routes Đăng Ký Kênh (`/subscriptions`) ok
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `POST /c/:channelId` - Đăng ký/Hủy đăng ký một kênh (Subscribe/Unsubscribe)
- `GET /c/:channelId` - Lấy danh sách người đăng ký của một kênh
- `GET /u/:subscriberId` - Lấy tất cả các kênh mà người dùng này đã đăng ký

###  Routes Danh Sách Phát (`/playlist`) ok
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `POST /` - Tạo danh sách phát mới
- `GET /user/:userId` - Lấy tất cả danh sách phát của một người dùng cụ thể
- `GET /:playlistId` - Lấy thông tin chi tiết của một danh sách phát theo ID
- `PATCH /:playlistId` - Cập nhật thông tin danh sách phát (tên, mô tả)
- `DELETE /:playlistId` - Xóa danh sách phát
- `PATCH /:playlistId/videos/:videoId` - Thêm video vào danh sách phát
- `DELETE /:playlistId/videos/:videoId` - Xóa video khỏi danh sách phát

###  Routes Bảng Điều Khiển (`/dashboard`)
*Tất cả routes này đều yêu cầu Xác thực (`verifyJWT`).*
- `GET /stats` - Lấy thống kê tổng quan của kênh (tổng lượt xem, người đăng ký, tổng video, lượt thích)
- `GET /videos` - Lấy tất cả video đã tải lên bởi chủ kênh (để quản lý trong dashboard)

---

## 🛠️ Cài Đặt và Khởi Chạy

1. **Clone repository này về máy**
2. **Cài đặt các dependencies:**
   ```bash
   npm install
   ```
3. **Thiết lập biến môi trường (Environment Setup):** Tạo một file `.env` ở thư mục gốc và thêm các thông tin sau:
   ```env
   PORT=8000
   MONGODB_URI=chuoi_ket_noi_mongodb_cua_ban
   CORS_ORIGIN=*
   
   ACCESS_TOKEN_SECRET=ma_bao_mat_access_token_cua_ban
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=ma_bao_mat_refresh_token_cua_ban
   REFRESH_TOKEN_EXPIRY=10d
   
   CLOUDINARY_CLOUD_NAME=ten_cloud_cua_ban
   CLOUDINARY_API_KEY=api_key_cua_ban
   CLOUDINARY_API_SECRET=api_secret_cua_ban
   ```
4. **Chạy server:**
   ```bash
   npm run dev
   ```

---
*Được tạo ra như một phần của các thử thách học tập backend.*