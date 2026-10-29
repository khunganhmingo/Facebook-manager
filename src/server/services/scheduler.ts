import { db } from '../config/db';
import { decryptData } from './encryption';
import { FacebookService } from './facebook';

export class SchedulerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start() {
    if (this.timer) return;
    // Check every 30 seconds
    this.timer = setInterval(() => {
      this.checkAndPublishDuePosts().catch(err => {
        console.error('Scheduler execution error:', err);
      });
    }, 30000);

    // Initial check
    setTimeout(() => {
      this.checkAndPublishDuePosts().catch(() => {});
    }, 5000);
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  static async checkAndPublishDuePosts(): Promise<number> {
    if (this.isRunning) return 0;
    this.isRunning = true;

    try {
      const nowIso = new Date().toISOString();
      const duePosts = db.prepare(`
        SELECT sp.*, p.page_id as fb_page_id, p.page_name, p.page_access_token_encrypted
        FROM scheduled_posts sp
        JOIN pages p ON sp.page_id = p.id
        WHERE sp.status = 'scheduled' AND datetime(sp.scheduled_at) <= datetime(?)
        ORDER BY sp.scheduled_at ASC
        LIMIT 10
      `).all(nowIso) as Array<{
        id: number;
        page_id: number;
        user_id: number;
        content: string;
        image_url: string | null;
        scheduled_at: string;
        status: string;
        retry_count: number;
        fb_page_id: string;
        page_name: string;
        page_access_token_encrypted: string;
      }>;

      if (!duePosts.length) {
        return 0;
      }

      let publishedCount = 0;

      for (const post of duePosts) {
        // Set to publishing
        db.prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run('publishing', post.id);

        const pageToken = decryptData(post.page_access_token_encrypted);
        const result = await FacebookService.publishPost(
          pageToken,
          post.fb_page_id,
          post.content,
          post.image_url || undefined
        );

        if (result.success && result.postId) {
          db.prepare(`
            UPDATE scheduled_posts
            SET status = 'published', fb_post_id = ?, error_message = NULL
            WHERE id = ?
          `).run(result.postId, post.id);

          db.prepare(`
            INSERT INTO activity_logs (page_id, action, details_json)
            VALUES (?, 'publish_post', ?)
          `).run(
            post.page_id,
            JSON.stringify({
              postId: post.id,
              fbPostId: result.postId,
              pageName: post.page_name,
              preview: post.content.slice(0, 60),
              isSimulated: result.isSimulated || false,
            })
          );
          publishedCount++;
        } else {
          const nextRetry = (post.retry_count || 0) + 1;
          const status = nextRetry >= 3 ? 'failed' : 'scheduled';
          db.prepare(`
            UPDATE scheduled_posts
            SET status = ?, retry_count = ?, error_message = ?
            WHERE id = ?
          `).run(status, nextRetry, result.error || 'Xuất bản thất bại', post.id);

          db.prepare(`
            INSERT INTO activity_logs (page_id, action, details_json)
            VALUES (?, 'error', ?)
          `).run(
            post.page_id,
            JSON.stringify({
              error: `Xuất bản bài đăng #${post.id} thất bại (Lần ${nextRetry})`,
              details: result.error,
            })
          );
        }
      }

      return publishedCount;
    } finally {
      this.isRunning = false;
    }
  }
}
