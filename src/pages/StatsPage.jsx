import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { Button } from '../components/common/Button.jsx';
import { Field, TextInput } from '../components/common/Field.jsx';
import { Alert } from '../components/common/Feedback.jsx';
import { statsApi } from '../api/stats.api.js';
import { config } from '../config.js';
import { messageForError } from '../utils/errorMessages.js';

const CODE_KEY = 'stats.code';

const readCode = () => {
  try {
    return sessionStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
};

const saveCode = (code) => {
  try {
    if (code) sessionStorage.setItem(CODE_KEY, code);
    else sessionStorage.removeItem(CODE_KEY);
  } catch {
    // Storage blocked: the code is just asked for again next time.
  }
};

const TILES = [
  { key: 'totalUsers', label: 'Users registered' },
  { key: 'totalChannelsCreated', label: 'Channels created' },
  { key: 'totalMessagesSent', label: 'Messages sent' },
  { key: 'activeChannels', label: 'Channels live now' },
];

/**
 * All-time usage numbers, behind an access code set on the server
 * (STATS_ACCESS_CODE). Channels and messages are counted when created, so
 * the totals do not drop when a channel expires.
 */
export const StatsPage = () => {
  const [code, setCode] = useState(readCode);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(async (value) => {
    setLoading(true);
    try {
      const data = await statsApi.get(value);
      setStats(data.stats);
      setError(null);
      saveCode(value);
    } catch (failure) {
      setStats(null);
      setError(messageForError(failure));
      saveCode(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reopen with the remembered code, then keep the numbers fresh.
  useEffect(() => {
    const remembered = readCode();
    if (remembered) void load(remembered);
  }, [load]);

  useEffect(() => {
    if (!stats) return undefined;
    const interval = setInterval(() => void load(readCode()), config.pollIntervalMs);
    return () => clearInterval(interval);
  }, [stats, load]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (code.trim()) void load(code.trim());
  };

  const lock = () => {
    saveCode(null);
    setStats(null);
    setCode('');
  };

  return (
    <AuthLayout
      title="Statistics"
      tagline={stats ? 'All-time totals. Deleted channels still count.' : 'Enter the access code.'}
      footer={<Link to="/channels">Back to channels</Link>}
    >
      {stats ? (
        <div className="auth-form">
          <dl className="stats-grid">
            {TILES.map((tile) => (
              <div key={tile.key} className="stats-tile">
                <dt className="stats-tile__label">{tile.label}</dt>
                <dd className="stats-tile__value">{stats[tile.key].toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <p className="field__hint">
            Updated {new Date(stats.generatedAt).toLocaleTimeString()} · refreshes every minute
          </p>
          <Button variant="secondary" block onClick={lock}>
            Lock
          </Button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Alert>{error}</Alert>
          <Field label="Access code">
            {(fieldProps) => (
              <TextInput
                {...fieldProps}
                type="password"
                autoFocus
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" block isLoading={isLoading}>
            Unlock
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};
