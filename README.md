# 🚀 SocialAgent AI - Nền Tảng Quản Lý Fanpage Facebook Tự Động Với AI Agent

Ứng dụng web SaaS quản lý Facebook Fanpage thông minh, kết nối trực tiếp qua API Key (Graph API), tự động phản hồi tin nhắn Messenger và bình luận bài viết theo kịch bản tùy biến, đồng thời sáng tạo nội dung bài đăng và lên lịch xuất bản tự động với AI Agent.

---

## 🎯 Tính Năng Nổi Bật

1. **Kết Nối Bằng API Key Trực Tiếp**:
   - Chỉ cần `Page ID` + `Page Access Token` (KHÔNG cần flow OAuth phức tạp).
   - Hỗ trợ quản lý đa trang (Multi-page).
   - Toàn bộ Access Token & API Key được mã hóa chuẩn **AES-256-GCM** trước khi lưu SQLite.

2. **AI Agent Thông Minh (Core Engine)**:
   - Tích hợp mô hình **Gemini 3.8 Flash** xử lý siêu tốc.
   - **Phân loại ý định (Intent Classification)**: Hỏi giá, hỏi ship, tư vấn, khen ngợi, khiếu nại, spam.
   - **Phân tích cảm xúc (Sentiment Analysis)** & **Chuyển giao người thật (Human Handoff)**: Nếu khách bức xúc, khiếu nại hoặc chửi bới, AI sẽ dừng trả lời tự động và gắn cờ báo động để nhân viên tiếp quản.
   - **Bộ nhớ ngữ cảnh**: Nhớ tối đa 6-10 tin nhắn gần nhất để trả lời liền mạch.

3. **Hộp Thư Messenger Tự Động (Auto-Reply Inbox)**:
   - Tự động phản hồi tin nhắn đến qua Facebook Webhook hoặc Send API.
   - Cấu hình khung giờ hoạt động (Active Hours) và độ trễ ngẫu nhiên (Random Delay 3-8s) tránh bị đánh dấu spam.
   - Giao diện chat trực quan kèm công cụ **Mô phỏng tin nhắn đến (Webhook Simulator)** để test AI realtime.

4. **Tự Động Trả Lời Bình Luận & Ẩn Spam (Comments)**:
   - Tự động nhận diện comment hỏi giá, hỏi mẫu để reply công khai kèm hướng dẫn kiểm tra inbox.
   - Tự động lọc từ khóa nhạy cảm và **ẩn bình luận rác (Auto-hide Spam)**.

5. **Sáng Tạo Nội Dung Bằng AI (Content Generator)**:
   - Nhập chủ đề & tone giọng → AI sinh ra **3 phiên bản (Variants)** độc đáo.
   - Xem trước giao diện bài viết Facebook chân thực (Live Mockup với Page Avatar, tương tác).
   - **Tạo nhanh 7 bài cho cả tuần (Weekly Batch Automation)** theo các Content Pillar.
   - Thư viện nội dung (Content Library) lưu trữ bài viết để tái sử dụng.

6. **Lên Lịch Đăng Bài & Cron Scheduler**:
   - Background worker tự động quét bài đến hạn mỗi phút và xuất bản qua Facebook Graph API.
   - **Cảnh báo trùng lịch (Conflict Detection)**: Cảnh báo nếu 2 bài lên lịch cách nhau dưới 30 phút.
   - Nút "Đăng ngay bây giờ" (Publish Now), đổi giờ đăng hoặc xóa bài.

7. **Quản Lý System Prompt (Custom Prompts)**:
   - 3 loại prompt riêng biệt cho mỗi Page: `message_reply`, `comment_reply`, `post_generation`.
   - Hỗ trợ biến số: `{{page_name}}`, `{{customer_name}}`, `{{product_list}}`, `{{tone}}`, `{{company_info}}`.
   - Lưu trữ lịch sử phiên bản và hỗ trợ **Khôi phục (Rollback)** phiên bản cũ.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Node.js, Express.js
- **Database**: SQLite (qua `better-sqlite3` với chế độ WAL)
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **AI Integration**: `@google/genai` (Gemini 3.8 Flash), hỗ trợ OpenAI / Claude qua API Key
- **Bảo Mật**: AES-256-GCM, JWT, bcryptjs, HMAC SHA-256 Webhook Verification

---

## 📦 Hướng Dẫn Cài Đặt & Chạy Local

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình biến môi trường
Sao chép `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Cấu hình các khóa bí mật:
- `GEMINI_API_KEY`: API Key của Google Gemini
- `ENCRYPTION_KEY`: Khóa mã hóa 32 ký tự cho AES-256
- `JWT_SECRET`: Khóa bí mật cho JWT token

### 3. Khởi động ứng dụng
```bash
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:3000`

---

## 🔑 Hướng Dẫn Lấy Facebook Page Access Token

1. Đăng nhập vào [Meta for Developers](https://developers.facebook.com/).
2. Vào mục **Công cụ (Tools)** → **Trình khám phá Graph API (Graph API Explorer)**:
   - Chọn ứng dụng Facebook của bạn.
   - Tại mục **Người dùng hoặc Trang (User or Page)**, chọn Fanpage bạn muốn kết nối.
   - Thêm các quyền (Permissions): `pages_manage_posts`, `pages_read_engagement`, `pages_messaging`, `pages_show_list`.
   - Nhấn **Generate Access Token** để lấy Token vĩnh viễn cho Page.
3. Lấy **Page ID**:
   - Truy cập Fanpage trên Facebook → Giới thiệu (About) → Xem **ID Trang (Page ID)**.
4. Mở tab **Quản lý Fanpage** trong ứng dụng SocialAgent AI và dán Page ID + Access Token để kết nối.

---

## 🌐 Hướng Dẫn Cấu Hình Facebook Webhook

1. Trong trang quản lý Facebook App (Meta Developers), vào mục **Webhooks**.
2. Chọn đối tượng là **Page** và chọn **Subscribe to this object**.
3. Điền thông tin:
   - **Callback URL**: `https://<ten-mien-cua-ban>/api/webhook/facebook`
   - **Verify Token**: `socialagent_fb_verify_token_2026`
4. Đăng ký các trường sự kiện (Fields):
   - `messages`: Nhận tin nhắn Messenger của khách hàng
   - `messaging_postbacks`: Nhận tương tác nút bấm
   - `feed`: Nhận sự kiện bình luận trên bài viết
