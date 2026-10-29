import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { encryptData } from '../services/encryption';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'facebook_manager.sqlite');

export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      ai_provider TEXT DEFAULT 'gemini',
      ai_base_url TEXT,
      ai_model TEXT DEFAULT 'gemini-3.8-flash',
      ai_api_key_encrypted TEXT,
      timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      page_id TEXT NOT NULL,
      page_name TEXT NOT NULL,
      page_access_token_encrypted TEXT NOT NULL,
      avatar_url TEXT,
      is_active BOOLEAN DEFAULT 1,
      auto_reply_messages BOOLEAN DEFAULT 1,
      auto_reply_comments BOOLEAN DEFAULT 1,
      active_hours_json TEXT DEFAULT '{"from":"08:00","to":"23:00","days":[1,2,3,4,5,6,7]}',
      reply_delay_min INTEGER DEFAULT 3,
      reply_delay_max INTEGER DEFAULT 8,
      skip_keywords TEXT DEFAULT '["lừa đảo","scam","vay vốn","bắn cá"]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- message_reply | comment_reply | post_generation
      content TEXT NOT NULL,
      ai_provider TEXT DEFAULT NULL,
      ai_model TEXT DEFAULT NULL,
      version INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      fb_message_id TEXT UNIQUE,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      content TEXT NOT NULL,
      direction TEXT NOT NULL, -- in | out
      ai_generated BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'pending', -- pending | sent | failed | requires_human
      requires_human BOOLEAN DEFAULT 0,
      intent TEXT,
      sentiment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      post_id TEXT,
      fb_comment_id TEXT UNIQUE,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      post_content TEXT,
      ai_reply TEXT,
      status TEXT DEFAULT 'pending', -- pending | replied | skipped | hidden | failed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      scheduled_at DATETIME NOT NULL,
      status TEXT DEFAULT 'scheduled', -- draft | scheduled | publishing | published | failed
      fb_post_id TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      topic TEXT,
      tone TEXT,
      used_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER,
      action TEXT NOT NULL, -- reply_message | reply_comment | publish_post | error | prompt_updated | page_connected
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_msgs_page_time ON messages(page_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_page_time ON comments(page_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sched_status_time ON scheduled_posts(status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_prompts_page_type ON prompts(page_id, type, is_active);
  `);

  try {
    db.exec('ALTER TABLE users ADD COLUMN ai_base_url TEXT;');
  } catch {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN ai_model TEXT DEFAULT 'gemini-3.5-flash';");
  } catch {}
  try {
    db.exec('ALTER TABLE prompts ADD COLUMN ai_provider TEXT DEFAULT NULL;');
  } catch {}
  try {
    db.exec('ALTER TABLE prompts ADD COLUMN ai_model TEXT DEFAULT NULL;');
  } catch {}

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) return;

  // Create demo user
  const demoPasswordHash = bcrypt.hashSync('admin123', 10);
  const userInsert = db.prepare(`
    INSERT INTO users (email, password_hash, ai_provider, ai_api_key_encrypted, timezone)
    VALUES (?, ?, ?, ?, ?)
  `);
  const userResult = userInsert.run(
    'khunganhredepmingo@gmail.com',
    demoPasswordHash,
    'gemini',
    encryptData(process.env.GEMINI_API_KEY || 'demo_api_key'),
    'Asia/Ho_Chi_Minh'
  );
  const userId = userResult.lastInsertRowid;

  // Insert sample Pages
  const pageInsert = db.prepare(`
    INSERT INTO pages (user_id, page_id, page_name, page_access_token_encrypted, avatar_url, is_active, auto_reply_messages, auto_reply_comments)
    VALUES (?, ?, ?, ?, ?, 1, 1, 1)
  `);

  const page1 = pageInsert.run(
    userId,
    '109283749102938',
    'Khung Ảnh Rẻ Đẹp Mingo Store',
    encryptData('EAAGNO41x9bQBAKZCpK...SAMPLE_TOKEN_MINGO'),
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=150&auto=format&fit=crop&q=80'
  );
  const page1Id = page1.lastInsertRowid;

  const page2 = pageInsert.run(
    userId,
    '203948571928301',
    'Mingo Decor & Canvas Studio',
    encryptData('EAAGNO41x9bQBAK...SAMPLE_TOKEN_STUDIO'),
    'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=150&auto=format&fit=crop&q=80'
  );
  const page2Id = page2.lastInsertRowid;

  // Seed default prompts for page 1
  const promptInsert = db.prepare(`
    INSERT INTO prompts (page_id, type, content, version, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  promptInsert.run(
    page1Id,
    'message_reply',
    `Bạn là trợ lý AI thông minh, tận tâm của Fanpage "{{page_name}}".
Khách hàng đang nhắn: "{{last_message}}".
Tên khách hàng: {{customer_name}}.
Danh mục sản phẩm: {{product_list}}.
Phong cách (Tone): {{tone}}.

Quy tắc phản hồi:
1. Chào hỏi thân thiện bằng tên khách (nếu có).
2. Trả lời đúng trọng tâm câu hỏi ngắn gọn, lịch sự, có 1-2 emoji phù hợp.
3. Nếu khách hỏi giá hoặc mẫu mã, gợi ý gửi kích thước mong muốn để tư vấn đúng nhu cầu.
4. KHÔNG spam, không hứa hẹn sai sự thật.`,
    1
  );

  promptInsert.run(
    page1Id,
    'comment_reply',
    `Bạn là chuyên viên chăm sóc khách hàng của page "{{page_name}}".
Bình luận của khách trên bài viết: "{{last_message}}".
Nội dung bài viết gốc: "{{post_content}}".

Yêu cầu phản hồi:
- Trả lời công khai tự nhiên, lịch sự, mời khách kiểm tra tin nhắn inbox để nhận ưu đãi hoặc bảng giá đầy đủ.
- Ngắn gọn (dưới 3 câu), tối đa 2 emoji.`,
    1
  );

  promptInsert.run(
    page1Id,
    'post_generation',
    `Bạn là Social Media Manager chuyên nghiệp cho page "{{page_name}}".
Viết bài đăng Facebook về chủ đề: {{topic}}
Tone: {{tone}}
Độ dài: {{length}}
Yêu cầu:
- Mở đầu với hook thu hút sự chú ý trong 1-2 câu đầu.
- Nội dung mang lại giá trị thực tế, bố cục rõ ràng, ngắt dòng dễ đọc.
- Kết thúc bằng lời kêu gọi hành động (CTA) cụ thể.
- Thêm 3-5 hashtag liên quan ở cuối bài.
- Ngôn ngữ: Tiếng Việt tự nhiên, phù hợp người dùng Facebook.`,
    1
  );

  // Seed sample messages
  const msgInsert = db.prepare(`
    INSERT INTO messages (page_id, fb_message_id, sender_id, sender_name, content, direction, ai_generated, status, requires_human, intent, sentiment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  msgInsert.run(
    page1Id, 'fb_msg_001', 'cust_101', 'Nguyễn Thu Trang',
    'Shop ơi cho mình xin kích thước khung ảnh để bàn và giá combo 3 khung nhé!',
    'in', 0, 'sent', 0, 'price_inquiry', 'neutral',
    new Date(Date.now() - 3600000 * 3).toISOString()
  );

  msgInsert.run(
    page1Id, 'fb_msg_002', 'cust_101', 'Khung Ảnh Rẻ Đẹp Mingo Store',
    'Dạ chào chị Thu Trang ạ! Combo 3 khung để bàn kích thước 13x18cm viền composite cao cấp giá ưu đãi 135.000đ/set. Shop có sẵn các màu Gỗ sồi, Trắng ngọc và Đen viền chỉ vàng. Chị thích tông màu nào để shop giữ hàng cho chị nhé! ✨',
    'out', 1, 'sent', 0, 'price_inquiry', 'positive',
    new Date(Date.now() - 3600000 * 3 + 15000).toISOString()
  );

  msgInsert.run(
    page1Id, 'fb_msg_003', 'cust_102', 'Lê Hoàng Nam',
    'Giao hàng về Đà Nẵng thì phí ship thế nào shop, khoảng mấy ngày tới nơi vậy?',
    'in', 0, 'sent', 0, 'shipping_inquiry', 'neutral',
    new Date(Date.now() - 3600000 * 2).toISOString()
  );

  msgInsert.run(
    page1Id, 'fb_msg_004', 'cust_102', 'Khung Ảnh Rẻ Đẹp Mingo Store',
    'Dạ chào anh Hoàng Nam! Đơn hàng gửi về Đà Nẵng Mingo hỗ trợ đồng giá 25k (freeship từ đơn 300k ạ). Hàng được bọc xốp bóng khí 3 lớp chắc chắn, khoảng 2-3 ngày là anh nhận được nhé! 📦',
    'out', 1, 'sent', 0, 'shipping_inquiry', 'neutral',
    new Date(Date.now() - 3600000 * 2 + 12000).toISOString()
  );

  msgInsert.run(
    page1Id, 'fb_msg_005', 'cust_103', 'Đặng Mai Phương',
    'Shop ơi hàng mình nhận bị nứt một góc kính rồi, bực mình quá, giải quyết đổi ngay giúp mình!',
    'in', 0, 'requires_human', 1, 'complaint', 'negative',
    new Date(Date.now() - 1800000).toISOString()
  );

  // Seed sample comments
  const commentInsert = db.prepare(`
    INSERT INTO comments (page_id, post_id, fb_comment_id, author_id, author_name, content, post_content, ai_reply, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  commentInsert.run(
    page1Id, 'fb_post_881', 'fb_cmt_001', 'fb_usr_201', 'Phạm Quỳnh Anh',
    'Set khung ảnh treo tường phòng khách 10 khung giá bao nhiêu vậy shop?',
    'BST Khung Ảnh Canvas & Treo Tường Hiện Đại 2026 - Giảm 20% Hôm Nay!',
    'Dạ chào bạn Quỳnh Anh! Set 10 khung tặng kèm sơ đồ định vị và đinh 3 chân thông minh đang ưu đãi 380k ạ. Shop đã nhắn inbox chi tiết các mẫu bố trí, bạn check tin nhắn giúp shop nhé! 🖼️',
    'replied', new Date(Date.now() - 5400000).toISOString()
  );

  commentInsert.run(
    page1Id, 'fb_post_881', 'fb_cmt_002', 'fb_usr_202', 'Trần Văn Đức',
    'Khung gỗ sồi tự nhiên hay gỗ công nghiệp vậy ad?',
    'BST Khung Ảnh Canvas & Treo Tường Hiện Đại 2026 - Giảm 20% Hôm Nay!',
    'Dạ Mingo có cả dòng gỗ sồi Nga tự nhiên phủ dầu lau bảo vệ và dòng composite chống cong vênh mối mọt ạ. Shop gửi hình cận chất gỗ qua inbox cho bạn xem liền nha! ✨',
    'replied', new Date(Date.now() - 3600000).toISOString()
  );

  commentInsert.run(
    page1Id, 'fb_post_881', 'fb_cmt_003', 'fb_usr_203', 'Tài Xỉu Uy Tín 88',
    'Tham gia nhóm telegram kiếm tiền 500k/ngày link bio!',
    'BST Khung Ảnh Canvas & Treo Tường Hiện Đại 2026',
    null,
    'hidden', new Date(Date.now() - 1200000).toISOString()
  );

  // Seed scheduled posts
  const postInsert = db.prepare(`
    INSERT INTO scheduled_posts (page_id, user_id, content, image_url, scheduled_at, status, fb_post_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  postInsert.run(
    page1Id, userId,
    `🌿 LÀM MỚI GÓC LÀM VIỆC VỚI SET 3 KHUNG ẢNH MINIMALIST

Bạn có biết: một góc làm việc ngăn nắp với những bức ảnh kỷ niệm ấm áp giúp giảm 30% stress và tăng cảm hứng sáng tạo mỗi ngày?

Set 3 khung ảnh gỗ mộc phong cách Bắc Âu tại Mingo:
✔️ Viền gỗ sồi nguyên khối gia công tỉ mỉ
✔️ Kính khoáng trong suốt chống trầy xước
✔️ Tặng kèm in ảnh theo yêu cầu chuẩn nét

👉 Nhắn tin ngay cho Mingo để nhận ưu đãi Freeship toàn quốc trong tuần này nhé!

#KhungAnhDep #DecorBanLamViec #MingoStore #KhungAnhGỗ #NoiThatToiGia`,
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
    new Date(Date.now() + 86400000).toISOString(),
    'scheduled',
    null
  );

  postInsert.run(
    page1Id, userId,
    `📸 BÍ QUYẾT TREO KHUNG ẢNH GIA ĐÌNH KHÔNG CẦN KHOAN TƯỜNG

Bạn muốn tạo một bức tường kỷ niệm nhưng sợ hỏng sơn tường? Lưu ngay mẹo treo khung cực dễ với đinh 3 chân và băng keo chuyên dụng từ Mingo Decor nhé!

1. Đo đạc khoảng cách và dán giấy định vị trước.
2. Dùng búa gõ nhẹ đinh 3 chân vào chân tường hoặc dùng keo Command.
3. Treo khung và ngắm nhìn tổ ấm lung linh!

Cmt ngay để Mingo gửi miễn phí file sơ đồ bố trí khung ảnh chuẩn tỉ lệ vàng nhé! ✨

#MeoHayDecor #KhungAnhGiaDinh #KhongKhoanTuong #MingoDecor`,
    'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=800&auto=format&fit=crop&q=80',
    new Date(Date.now() + 86400000 * 2).toISOString(),
    'scheduled',
    null
  );

  postInsert.run(
    page1Id, userId,
    `🎉 CHÚC MỪNG KHAI TRƯƠNG BỘ SƯU TẬP KHUNG TRANH CANVAS 2026

Cảm ơn hơn 10.000 khách hàng đã đồng hành cùng Mingo trong suốt 3 năm qua. Hôm nay Mingo chính thức mở bán bộ sưu tập mới với ưu đãi Mua 2 Tặng 1!

Inbox ngay hôm nay để giữ suất quà tặng giới hạn bạn nhé! ❤️

#KhaiTruong #KhungTranhCanvas #MingoStore #UuDaiKhungAnh`,
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
    new Date(Date.now() - 86400000).toISOString(),
    'published',
    'fb_post_881'
  );

  // Seed content library
  const libInsert = db.prepare(`
    INSERT INTO content_library (user_id, content, topic, tone, used_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  libInsert.run(
    userId,
    'Set 5 khung ảnh canvas hoa cỏ mùa hạ - Mang hơi thở thiên nhiên vào căn hộ chung cư hiện đại. Chất liệu vải canvas nhập khẩu không phai màu.',
    'Decor phòng khách mùa hè',
    'Truyền cảm hứng',
    3
  );

  libInsert.run(
    userId,
    'Đừng để ảnh cưới, ảnh bé yêu chỉ nằm trong điện thoại! In ngay set khung để bàn tráng gương cao cấp bảo hành 10 năm tại Mingo.',
    'Lưu giữ kỷ niệm gia đình',
    'Bán hàng cảm xúc',
    5
  );

  // Seed activity log
  const logInsert = db.prepare(`
    INSERT INTO activity_logs (page_id, action, details_json)
    VALUES (?, ?, ?)
  `);

  logInsert.run(page1Id, 'page_connected', JSON.stringify({ message: 'Kết nối thành công Fanpage Khung Ảnh Rẻ Đẹp Mingo Store' }));
  logInsert.run(page1Id, 'reply_message', JSON.stringify({ sender: 'Nguyễn Thu Trang', intent: 'price_inquiry', ai_generated: true }));
  logInsert.run(page1Id, 'reply_comment', JSON.stringify({ author: 'Phạm Quỳnh Anh', status: 'replied' }));
  logInsert.run(page1Id, 'reply_comment', JSON.stringify({ author: 'Tài Xỉu Uy Tín 88', status: 'hidden', reason: 'Spam keyword' }));
  logInsert.run(page1Id, 'publish_post', JSON.stringify({ title: 'Khai trương BST Khung Tranh Canvas 2026', fb_post_id: 'fb_post_881' }));
}
