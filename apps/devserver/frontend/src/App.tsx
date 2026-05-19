import { useEffect, useState } from 'react';

type Health = {
  status: string;
  service: string;
  time: string;
};

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Unknown error'),
      );
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Arcade2D Dev Server</h1>
      <p>Editor and tooling frontend. Backend connectivity:</p>
      {error && <pre style={{ color: 'crimson' }}>Backend error: {error}</pre>}
      {health ? (
        <pre>{JSON.stringify(health, null, 2)}</pre>
      ) : (
        !error && <p>Checking /api/health…</p>
      )}
    </main>
  );
}
