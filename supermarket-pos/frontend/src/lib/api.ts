const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");

export async function apiDownload(path: string, filename: string) {
  const fetchFile = () =>
    fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${tokenStore.accessToken}` },
    });
  let response = await fetchFile();
  if (response.status === 401 && (await tryRefresh()))
    response = await fetchFile();
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Download failed");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The backend returns relative paths like "/uploads/xyz.jpg". Resolved
// as-is in an <img src>, the browser would look for that path on the
// frontend's own origin (the Vite dev server), not the API server — so
// asset URLs need to be resolved against the API's origin explicitly.
const ASSET_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function assetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${ASSET_ORIGIN}${path}`;
}

const ACCESS_TOKEN_KEY = "pos.accessToken";
const REFRESH_TOKEN_KEY = "pos.refreshToken";

// Session-scoped token cache. Good enough for Phase 1; revisit before
// production (e.g. httpOnly cookies issued by the API) since sessionStorage
// is readable by any script on the page.
export const tokenStore = {
  get accessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clear() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refreshToken;
  if (!refreshToken) return false;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    tokenStore.clear();
    return false;
  }

  const data = await res.json();
  tokenStore.set({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return true;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  authenticated?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, authenticated = true } = options;

  const doFetch = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authenticated && tokenStore.accessToken) {
      headers.Authorization = `Bearer ${tokenStore.accessToken}`;
    }
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && authenticated) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    if (await refreshPromise) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const data = await res.json();
      message = data?.error?.message ?? message;
      code = data?.error?.code;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Separate from apiRequest because multipart bodies can't be JSON-stringified
// and must NOT have a manual Content-Type set (the browser generates the
// multipart boundary itself). Doesn't retry on 401 — acceptable for Phase 2;
// worth folding into the shared retry path if uploads become more central.
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (tokenStore.accessToken)
    headers.Authorization = `Bearer ${tokenStore.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    let message = `Upload failed with status ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error?.message ?? message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}
