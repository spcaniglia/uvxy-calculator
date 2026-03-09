import express from 'express';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface UpdateJobStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
  logLines: string[];
}

const LOG_LIMIT = 2000;
const PORT = Number(process.env.UPDATE_API_PORT ?? 8787);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.resolve(repoRoot, 'update_app_data.sh');

const status: UpdateJobStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  error: null,
  logLines: [],
};

const pushLogLine = (line: string) => {
  const clean = line.replace(/\r/g, '').trimEnd();
  if (!clean) return;
  status.logLines.push(clean);
  if (status.logLines.length > LOG_LIMIT) {
    status.logLines.splice(0, status.logLines.length - LOG_LIMIT);
  }
};

const appendChunk = (chunk: Buffer, prefix = '') => {
  const text = chunk.toString('utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    pushLogLine(`${prefix}${line}`);
  }
};

const startUpdate = () => {
  const startedAt = new Date().toISOString();
  status.running = true;
  status.startedAt = startedAt;
  status.finishedAt = null;
  status.exitCode = null;
  status.error = null;
  status.logLines = [`[${startedAt}] Starting update script: ${scriptPath}`];

  const child = spawn('bash', [scriptPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => appendChunk(chunk));
  child.stderr?.on('data', (chunk: Buffer) => appendChunk(chunk, '[stderr] '));

  child.on('error', (err) => {
    status.error = err.message;
    pushLogLine(`[error] ${err.message}`);
  });

  child.on('close', (code) => {
    status.running = false;
    status.finishedAt = new Date().toISOString();
    status.exitCode = typeof code === 'number' ? code : -1;
    pushLogLine(`[${status.finishedAt}] Update finished with exit code ${status.exitCode}.`);
  });
};

const app = express();
app.use(express.json());

app.get('/api/update-data/status', (_req, res) => {
  res.json(status);
});

app.post('/api/update-data/start', (_req, res) => {
  if (status.running) {
    res.status(409).json({
      ...status,
      error: 'Update is already running.',
    });
    return;
  }

  if (!existsSync(scriptPath)) {
    status.error = `Script not found at ${scriptPath}`;
    res.status(500).json({
      ...status,
      error: status.error,
    });
    return;
  }

  startUpdate();
  res.status(202).json(status);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Update API listening on http://127.0.0.1:${PORT}`);
});
