// A temporary verification server; scheduled jobs are started only by index.js.
const path = require('node:path')
const backend = process.env.CHOICEMEE_STAGED_BACKEND
if (!backend || !path.isAbsolute(backend)) throw new Error('Staged backend path is required')
const { server } = require(path.join(backend, 'dist/app.js'))
const { pool } = require(path.join(backend, 'dist/models/client.js'))
server.listen(Number(process.env.PORT || 5013), '127.0.0.1', () =>
  console.log('ChoiceMee candidate API ready'),
)
process.on('SIGINT', () => {
  server.close(() => pool.end().finally(() => process.exit(0)))
})
