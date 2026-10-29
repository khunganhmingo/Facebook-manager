import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initDatabase } from './src/server/config/db';
import { SchedulerService } from './src/server/services/scheduler';
import { authRouter } from './src/server/routes/auth';
import { pagesRouter } from './src/server/routes/pages';
import { messagesRouter } from './src/server/routes/messages';
import { commentsRouter } from './src/server/routes/comments';
import { postsRouter } from './src/server/routes/posts';
import { promptsRouter } from './src/server/routes/prompts';
import { aiRouter } from './src/server/routes/ai';
import { webhookRouter } from './src/server/routes/webhook';
import { analyticsRouter } from './src/server/routes/analytics';
import { adminRouter } from './src/server/routes/admin';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize SQLite Database with tables & seed data
  initDatabase();

  // Start background post scheduler
  SchedulerService.start();

  // Standard JSON and URL-encoded body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/prompts', promptsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/webhook', webhookRouter);
  app.use('/api/analytics', analyticsRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SocialAgent AI',
      time: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  if (!isProd) {
    // Development mode with Vite middlewares
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SocialAgent AI server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
