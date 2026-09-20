import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

import { startBackupScheduler } from './services/backup.service';
const app = createApp();
startBackupScheduler();

app.listen(env.port, env.host, () => {
  logger.info(`POS backend listening on port ${env.port}`, { env: env.nodeEnv });
});
