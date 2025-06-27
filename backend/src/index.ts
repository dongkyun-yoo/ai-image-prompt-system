import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { setupDatabase } from './utils/database';
import { setupRedis } from './utils/redis';
import { setupQueue } from './utils/queue';
import { setupLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';

// Routes
import promptRoutes from './routes/prompts';
import imageRoutes from './routes/images';
import userRoutes from './routes/users';
import collectionRoutes from './routes/collections';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Logger setup
const logger = setupLogger();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Public routes
app.use('/api/users', userRoutes);

// Protected routes
app.use('/api/prompts', authMiddleware, promptRoutes);
app.use('/api/images', authMiddleware, imageRoutes);
app.use('/api/collections', authMiddleware, collectionRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

async function startServer() {
  try {
    // Initialize database
    await setupDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    await setupRedis();
    logger.info('Redis connected successfully');

    // Initialize Queue
    await setupQueue();
    logger.info('Queue system initialized');

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();

export default app;