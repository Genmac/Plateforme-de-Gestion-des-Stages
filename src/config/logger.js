const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' });

const formatMessage = (level, message, meta = '') => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
};

const logger = {
  info: (msg, meta) => {
    const line = formatMessage('info', msg, meta);
    process.stdout.write(line);
    logStream.write(line);
  },
  warn: (msg, meta) => {
    const line = formatMessage('warn', msg, meta);
    process.stdout.write(line);
    logStream.write(line);
  },
  error: (msg, meta) => {
    const line = formatMessage('error', msg, meta);
    process.stderr.write(line);
    logStream.write(line);
  }
};

module.exports = logger;