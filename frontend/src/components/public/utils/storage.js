// Acceso seguro a localStorage / sessionStorage: en modo privado o con datos bloqueados
// el acceso lanza excepciones, así que todo va en try/catch y la web sigue funcionando sin él.

function createStore(name) {
  const area = () => {
    try {
      return window[name];
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return area()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        area()?.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        area()?.removeItem(key);
      } catch {
        /* sin almacenamiento */
      }
    },
    getJSON(key, fallback = null) {
      const raw = this.get(key);
      if (!raw) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    setJSON(key, value) {
      try {
        return this.set(key, JSON.stringify(value));
      } catch {
        return false;
      }
    },
  };
}

export const local = createStore('localStorage');
export const session = createStore('sessionStorage');

export const KEYS = {
  lastOrder: 'fd_last_order',
  introSeen: 'fd_intro_seen',
  celebrated: 'fd_celebrated',
  noticeDismissed: 'fd_notice_dismissed',
  buyDraft: 'fd_buy_draft',
  configCache: 'fd_public_config',
};

export function rememberOrder(token) {
  if (token) local.set(KEYS.lastOrder, token);
}

export function hasCelebrated(token) {
  const list = local.getJSON(KEYS.celebrated, []);
  return Array.isArray(list) && list.includes(token);
}

export function markCelebrated(token) {
  const list = local.getJSON(KEYS.celebrated, []);
  const arr = Array.isArray(list) ? list : [];
  if (!arr.includes(token)) {
    arr.push(token);
    local.setJSON(KEYS.celebrated, arr.slice(-30));
  }
}
