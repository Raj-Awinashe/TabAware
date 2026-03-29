import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeDatabase, run, all, get } from './db';
import {
  isDistractingDomain,
  extractDomain,
  buildMetrics,
  classifyState,
  recommendationForState,
  normalizeDomain,
} from './logic/stateEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'TabAware_dev_secret_change_me';
const ALLOWED_EVENT_TYPES = ['TAB_SWITCH', 'PAGE_LOAD'];

type AuthedRequest = express.Request & {
  user?: {
    id: number;
    email: string;
  };
};

function createToken(user: { id: number; email: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function authMiddleware(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token.' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    req.user = {
      id: decoded.id,
      email: decoded.email,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid auth token.' });
  }
}

async function getOrCreateActiveSession(userId: number) {
  let session = await get(
    `
    SELECT *
    FROM sessions
    WHERE user_id = ? AND is_active = 1
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (!session) {
    const now = Date.now();
    const result = await run(
      `
      INSERT INTO sessions (user_id, started_at, is_active)
      VALUES (?, ?, 1)
      `,
      [userId, now]
    );

    session = await get(`SELECT * FROM sessions WHERE id = ?`, [result.lastID]);
  }

  return session;
}

async function resetActiveSession(userId: number) {
  const now = Date.now();

  await run(
    `
    UPDATE sessions
    SET ended_at = ?, is_active = 0
    WHERE user_id = ? AND is_active = 1
    `,
    [now, userId]
  );

  const result = await run(
    `
    INSERT INTO sessions (user_id, started_at, is_active)
    VALUES (?, ?, 1)
    `,
    [userId, now]
  );

  return get(`SELECT * FROM sessions WHERE id = ?`, [result.lastID]);
}

async function startServer() {
  const app = express();

  await initializeDatabase();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existingUser = await get(`SELECT * FROM users WHERE email = ?`, [email]);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = Date.now();

      const result = await run(
        `
        INSERT INTO users (email, password_hash, created_at)
        VALUES (?, ?, ?)
        `,
        [email, passwordHash, now]
      );

      const user = { id: result.lastID, email };
      await getOrCreateActiveSession(user.id);

      const token = createToken(user);

      res.status(201).json({
        token,
        user,
      });
    } catch (error) {
      console.error('Signup failed:', error);
      res.status(500).json({ error: 'Signup failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const userRow = await get(`SELECT * FROM users WHERE email = ?`, [email]);
      if (!userRow) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const passwordOk = await bcrypt.compare(password, userRow.password_hash);
      if (!passwordOk) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = { id: userRow.id, email: userRow.email };
      await getOrCreateActiveSession(user.id);

      const token = createToken(user);

      res.json({
        token,
        user,
      });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  app.get('/api/auth/me', authMiddleware, async (req: AuthedRequest, res) => {
    res.json({
      user: req.user,
    });
  });

  app.get('/api/session/current', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const session = await getOrCreateActiveSession(req.user!.id);
      res.json(session);
    } catch (error) {
      console.error('Failed to fetch current session:', error);
      res.status(500).json({ error: 'Failed to fetch current session.' });
    }
  });

  app.post('/api/session/reset', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const session = await resetActiveSession(req.user!.id);
      res.json(session);
    } catch (error) {
      console.error('Failed to reset session:', error);
      res.status(500).json({ error: 'Failed to reset session.' });
    }
  });

  // PUBLIC FOR EXTENSION
  app.post('/api/events', async (req, res) => {
    try {
      const {
        url = '',
        title = '',
        eventType = 'TAB_SWITCH',
        timestamp = Date.now(),
        tabId = null,
      } = req.body ?? {};

      if (typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: 'Valid url is required.' });
      }

      if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
        return res.status(400).json({ error: 'Invalid event type.' });
      }

      const domain = extractDomain(url);
      if (!domain) {
        return res.status(400).json({ error: 'Could not extract domain.' });
      }

      const parsedTimestamp = parseTimestamp(timestamp);

      const blockedRows = await all(`SELECT domain FROM blocked_sites`);
      const blockedDomains = blockedRows.map((row) => row.domain);

      const distracting = (await isDistractingDomain(domain, blockedDomains)) ? 1 : 0;

      await run(
        `
        INSERT INTO browser_events (
          user_id, session_id, timestamp, domain, url, title, event_type, tab_id, is_distracting
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          1,
          1,
          parsedTimestamp,
          domain,
          url,
          title,
          eventType,
          tabId,
          distracting,
        ]
      );

      res.status(201).json({
        success: true,
        domain,
        distracting: Boolean(distracting),
        sessionId: 1,
      });
    } catch (error) {
      console.error('Failed to save event:', error);
      res.status(500).json({ error: 'Failed to save event.' });
    }
  });

  app.get('/api/status', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const session = await getOrCreateActiveSession(req.user!.id);

      const events = await all(
        `
        SELECT *
        FROM browser_events
        WHERE user_id = ? AND session_id = ?
        ORDER BY timestamp ASC
        `,
        [req.user!.id, session.id]
      );

      const metrics = buildMetrics(events);
      const state = classifyState(metrics);
      const recommendation = recommendationForState(state);

      res.json({
        state,
        recommendation,
        session,
        metrics: {
          ...metrics,
          distractingDomainsSeen: Array.from(metrics.distractingDomainsSeen),
          productiveDomainsSeen: Array.from(metrics.productiveDomainsSeen),
        },
      });
    } catch (error) {
      console.error('Failed to compute status:', error);
      res.status(500).json({ error: 'Failed to compute status.' });
    }
  });

  app.get('/api/summary', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const session = await getOrCreateActiveSession(req.user!.id);

      const rows = await all(
        `
        SELECT domain, COUNT(*) AS count, SUM(is_distracting) AS distracting_count
        FROM browser_events
        WHERE user_id = ? AND session_id = ?
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
        `,
        [req.user!.id, session.id]
      );

      res.json(rows);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary.' });
    }
  });

  app.get('/api/events/recent', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const session = await getOrCreateActiveSession(req.user!.id);

      const rows = await all(
        `
        SELECT id, timestamp, domain, title, event_type, is_distracting
        FROM browser_events
        WHERE user_id = ? AND session_id = ?
        ORDER BY timestamp DESC
        LIMIT 30
        `,
        [req.user!.id, session.id]
      );

      res.json(rows);
    } catch (error) {
      console.error('Failed to fetch recent events:', error);
      res.status(500).json({ error: 'Failed to fetch recent events.' });
    }
  });

  // PUBLIC FOR EXTENSION
  app.get('/api/blocked-sites', async (req, res) => {
    try {
      const rows = await all(
        `SELECT * FROM blocked_sites ORDER BY domain ASC`
      );
      res.json(rows);
    } catch (error) {
      console.error('Failed to fetch blocked sites:', error);
      res.status(500).json({ error: 'Failed to fetch blocked sites.' });
    }
  });

  app.post('/api/blocked-sites', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const domain = normalizeDomain(String(req.body?.domain || ''));

      if (!domain) {
        return res.status(400).json({ error: 'Domain is required.' });
      }

      await run(
        `
        INSERT OR IGNORE INTO blocked_sites (user_id, domain)
        VALUES (?, ?)
        `,
        [req.user!.id, domain]
      );

      res.status(201).json({ success: true, domain });
    } catch (error) {
      console.error('Failed to add blocked site:', error);
      res.status(500).json({ error: 'Failed to add blocked site.' });
    }
  });

  app.delete('/api/blocked-sites/:id', authMiddleware, async (req: AuthedRequest, res) => {
    try {
      await run(
        `
        DELETE FROM blocked_sites
        WHERE id = ? AND user_id = ?
        `,
        [req.params.id, req.user!.id]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to remove blocked site:', error);
      res.status(500).json({ error: 'Failed to remove blocked site.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TabAware server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});