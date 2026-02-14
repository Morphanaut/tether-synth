const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const warnedKeys = new Set<string>();

const isDevRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return DEV_HOSTS.has(host) || host.endsWith('.local');
};

export const warnOnceInDev = (scope: string, error: unknown): void => {
    if (!isDevRuntime()) return;
    const message = error instanceof Error ? error.message : String(error);
    const key = `${scope}:${message}`;
    if (warnedKeys.has(key)) return;
    warnedKeys.add(key);
    console.warn(scope, error);
};
