import { createApp } from './server.js';

const port = Number(process.env.PORT || '4000');
const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    process.stdout.write(`generator-api listening on ${port}\n`);
  });
}
