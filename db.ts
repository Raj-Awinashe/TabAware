import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'TabAware.db');
const db = new sqlite3.Database(dbPath);

export function initializeDatabase() {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
        `,
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(
            `
            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              started_at INTEGER NOT NULL,
              ended_at INTEGER,
              is_active INTEGER DEFAULT 1,
              FOREIGN KEY(user_id) REFERENCES users(id)
            )
            `,
            (err2) => {
              if (err2) {
                reject(err2);
                return;
              }

              db.run(
                `
                CREATE TABLE IF NOT EXISTS browser_events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  session_id INTEGER NOT NULL,
                  timestamp INTEGER NOT NULL,
                  domain TEXT NOT NULL,
                  url TEXT,
                  title TEXT,
                  event_type TEXT NOT NULL,
                  tab_id INTEGER,
                  is_distracting INTEGER DEFAULT 0,
                  FOREIGN KEY(user_id) REFERENCES users(id),
                  FOREIGN KEY(session_id) REFERENCES sessions(id)
                )
                `,
                (err3) => {
                  if (err3) {
                    reject(err3);
                    return;
                  }

                  db.run(
                    `
                    CREATE TABLE IF NOT EXISTS blocked_sites (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER NOT NULL,
                      domain TEXT NOT NULL,
                      FOREIGN KEY(user_id) REFERENCES users(id),
                      UNIQUE(user_id, domain)
                    )
                    `,
                    (err4) => {
                      if (err4) {
                        reject(err4);
                        return;
                      }

                      db.run(
                        `CREATE INDEX IF NOT EXISTS idx_browser_events_user_session_timestamp ON browser_events(user_id, session_id, timestamp)`,
                        (err5) => {
                          if (err5) {
                            reject(err5);
                            return;
                          }

                          db.run(
                            `CREATE INDEX IF NOT EXISTS idx_blocked_sites_user_domain ON blocked_sites(user_id, domain)`,
                            (err6) => {
                              if (err6) {
                                reject(err6);
                                return;
                              }

                              resolve();
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
}

export function run(query: string, params: any[] = []) {
  return new Promise<any>((resolve, reject) => {
    db.run(query, params, function (this: any, error: any) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

export function all(query: string, params: any[] = []) {
  return new Promise<any[]>((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

export function get(query: string, params: any[] = []) {
  return new Promise<any>((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}