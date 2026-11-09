/* ===================================================================== SYNC
   Two ways to keep phone and PC on the same data, both built on mergeRemote():
   - Installed app: a private (secret) Gist on the user's own GitHub account.
   - Inside a Claude artifact: the artifact's own per-person database.
   Local storage always stays the source the app renders from, so everything
   keeps working offline and catches up later. */

const Sync = (() => {
  const API = 'https://api.github.com';
  const FILE = 'tagwerk.json';
  const DESC = 'Tagwerk Sync';
  const POLL_MS = 90 * 1000;

  let backend = null;
  let status = 'off'; // off | connecting | syncing | ok | offline | error
  let message = '';
  let lastAt = 0;
  let timer = 0;
  let pollTimer = 0;
  let busy = false;
  let again = false;
  let onRemoteChange = () => {};
  let onStatus = () => {};

  const setStatus = (s, msg = '') => {
    status = s;
    message = msg;
    onStatus();
  };

  /* ------------------------------------------------------------ GitHub */
  async function gh(path, token, opts = {}) {
    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body,
    });
    if (!res.ok) {
      const err = new Error(`GitHub ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  const gistBackend = (token, gistId) => ({
    kind: 'gist',
    async pull() {
      const gist = await gh(`/gists/${gistId}`, token);
      const file = gist.files && gist.files[FILE];
      if (!file) return null;
      const text = file.truncated ? await (await fetch(file.raw_url, { cache: 'no-store' })).text() : file.content;
      return JSON.parse(text);
    },
    push(state) {
      return gh(`/gists/${gistId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(state) } } }),
      });
    },
  });

  /** First device creates the secret Gist, every further device finds it again. */
  async function connectGist(token) {
    setStatus('connecting');
    try {
      const list = await gh('/gists?per_page=100', token);
      const found = list.find((g) => g.description === DESC && g.files && g.files[FILE]);
      let id = found && found.id;
      if (!id) {
        const created = await gh('/gists', token, {
          method: 'POST',
          body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(S) } } }),
        });
        id = created.id;
      }
      L.sync = { kind: 'gist', token, gistId: id };
      saveLocal();
      backend = gistBackend(token, id);
      startPolling();
      await run();
      return true;
    } catch (e) {
      setStatus('error', explain(e));
      return false;
    }
  }

  function disconnect() {
    L.sync = null;
    saveLocal();
    backend = null;
    clearInterval(pollTimer);
    setStatus('off');
  }

  function explain(e) {
    if (e.status === 401) return 'GitHub hat den Token nicht akzeptiert. Erstelle einen neuen mit dem Recht „gist“.';
    if (e.status === 403 || e.status === 429) return 'GitHub bremst gerade. In ein paar Minuten klappt es wieder.';
    if (e.status === 404) return 'Der Speicherort auf GitHub wurde nicht gefunden. Trenne die Verbindung und verbinde dich neu.';
    return 'Keine Verbindung. Deine Änderungen sind gespeichert und werden später übertragen.';
  }

  /* ----------------------------------------------------- Claude artifact */
  const artifactBackend = (coll) => {
    const written = {};
    return {
      kind: 'artifact',
      async pull() {
        const snap = await coll.get();
        return snap.empty ? null : assembleShards(snap.docs.map((d) => d.data()));
      },
      async push(state) {
        for (const [key, value] of Object.entries(shardState(state))) {
          const json = JSON.stringify(value);
          if (written[key] === json) continue;
          await coll.doc(key).set(value);
          written[key] = json;
        }
      },
    };
  };

  async function connectArtifact() {
    if (!window.claude || !window.claude.use) return;
    setStatus('connecting');
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const id = db && user ? await user.id() : null;
    if (!id) {
      setStatus('off', 'Nicht angemeldet: Deine Daten bleiben nur auf diesem Gerät.');
      return;
    }
    const coll = db.collection(`data/users/${id}`);
    backend = artifactBackend(coll);
    await run();
    // Changes from the other device arrive live.
    coll.onSnapshot(
      (snap) => {
        if (snap.metadata.hasPendingWrites || snap.metadata.fromCache || snap.empty) return;
        if (mergeRemote(assembleShards(snap.docs.map((d) => d.data())))) onRemoteChange();
      },
      () => setStatus('offline', 'Die Verbindung wurde getrennt. Lade die Seite neu, um wieder zu synchronisieren.'),
    );
  }

  /* ----------------------------------------------------------- Run loop */
  async function run() {
    if (!backend) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    setStatus('syncing');
    try {
      const remote = await backend.pull();
      const changed = remote ? mergeRemote(remote) : false;
      if (!remote || needsPush(remote)) await backend.push(S);
      lastAt = Date.now();
      setStatus('ok');
      if (changed) onRemoteChange();
    } catch (e) {
      setStatus(e.status === 401 ? 'error' : 'offline', e.status ? explain(e) : explain({}));
    }
    busy = false;
    if (again) {
      again = false;
      schedule(800);
    }
  }

  function schedule(delay = 1800) {
    if (!backend) return;
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, POLL_MS);
  }

  function init(handlers) {
    onRemoteChange = handlers.onRemoteChange;
    onStatus = handlers.onStatus;
    onStoreChange = () => schedule();
    addEventListener('online', () => run());
    document.addEventListener('visibilitychange', () => {
      if (backend) run();
    });
    if (TARGET === 'artifact') {
      connectArtifact().catch(() => setStatus('off'));
    } else if (L.sync && L.sync.kind === 'gist') {
      backend = gistBackend(L.sync.token, L.sync.gistId);
      startPolling();
      run();
    }
  }

  return {
    init,
    run,
    connectGist,
    disconnect,
    get status() {
      return status;
    },
    get message() {
      return message;
    },
    get lastAt() {
      return lastAt;
    },
    get connected() {
      return !!backend;
    },
  };
})();
