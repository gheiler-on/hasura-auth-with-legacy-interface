import { ENV } from '@/utils/env';
import { logger, LOG_LEVEL } from './logger';

export const start = async () => {
  logger.info(`Log level: ${LOG_LEVEL}`);

  /**
   * Async imports allow to dynamically import the required modules,
   * and therefore only import modules that are required, when they are required.
   * It decreases the loading time on startup.
   * If we decide to apply migrations/metadata in a separate moment e.g. k8s initContainer,
   * it will allow hasura-auth to load modules only required for migrations/metadata,
   * or not to load these modules when auto migration/metadata is disabled.
   */
  // if (ENV.AUTH_SKIP_INIT) {
  //   logger.info(`Skipping migrations and metadata`);
  // } else {
  const { waitForHasura } = await import('@/utils');
  const { applyMigrations } = await import('./migrations');
  const { applyMetadata } = await import('./metadata');

  // wait for hasura to be ready
  await waitForHasura();
  // apply migrations and metadata
  await applyMigrations();
  await applyMetadata();
  // }

  // if (ENV.AUTH_SKIP_SERVE) {
  //   logger.info(
  //     `AUTH_SKIP_SERVE has been set to true, therefore Hasura-Auth won't start`
  //   );
  // } else {
  await import('./env-vars-check');
  const { app } = await import('./app');

  app.listen(ENV.AUTH_PORT, ENV.AUTH_HOST, () => {
    if (ENV.AUTH_HOST) {
      logger.info(`Running on http://${ENV.AUTH_HOST}:${ENV.AUTH_PORT}`);
    } else {
      logger.info(`Running on port ${ENV.AUTH_PORT}`);
    }
  });
  // }
};
