const express = require('express');
const path = require('path');
const { auditUrl, AuditError } = require('./src/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/audit', async (req, res) => {
  const { url } = req.body || {};

  try {
    const report = await auditUrl(url);
    res.status(200).json(report);
  } catch (err) {
    if (err instanceof AuditError) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
      });
    }
    // Unknown/unexpected error — never let the process or response crash.
    console.error('Unexpected error auditing URL:', err);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong on our end while auditing that page.',
    });
  }
});

// Fallback: unmatched API routes get JSON 404s, not the SPA's HTML.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'No such endpoint.' });
});

app.listen(PORT, () => {
  console.log(`Page Pulse listening on http://localhost:${PORT}`);
});

module.exports = app;
