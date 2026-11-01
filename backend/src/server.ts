import { createApp } from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'
import { checkEmailTransport } from './services/email.js'

async function start() {
  try {
    await pool.query('SELECT 1 FROM schema_migrations LIMIT 1')
  } catch (error) {
    console.error(`Can't use the database: ${(error as Error).message}`)
    console.error('Check DATABASE_URL and run "npm run db:migrate".')
    process.exit(1)
  }

  const server = createApp().listen(env.PORT, (error) => {
    // Express 5 reports a failed start here, such as the port already being in use.
    if (error) {
      console.error(`Can't start on port ${env.PORT}: ${error.message}`)
      process.exit(1)
    }
    console.log(`NagorikPass API listening on http://localhost:${env.PORT}`)
    void checkEmailTransport().then(console.log)
  })

  const shutdown = () => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0))
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

void start()
