const net = require('net');

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

const server = net.createServer();

server.once('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[predev] Port ${port} is already in use.`);
    console.error('[predev] Backend likely already running in another terminal.');
    console.error('[predev] Stop the old process, or run with another port.');
    console.error('[predev] PowerShell example: $env:PORT="4001"; npm run dev');
    process.exit(1);
    return;
  }

  console.error('[predev] Failed to probe port:', err);
  process.exit(1);
});

server.once('listening', () => {
  server.close(() => process.exit(0));
});

server.listen(port, host);