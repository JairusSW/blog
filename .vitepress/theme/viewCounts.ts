const VIEW_COUNT_PREFIX = "blog:post-views:";
const SESSION_VIEW_PREFIX = "blog:post-viewed:";
const VIEW_COUNT_EVENT = "blog:post-view-count-changed";

export function isClientSide() {
  return typeof window !== "undefined";
}

export function getPostViewCount(slug: string) {
  if (!isClientSide() || !slug) return 0;

  const stored = window.localStorage.getItem(`${VIEW_COUNT_PREFIX}${slug}`);
  const value = Number.parseInt(stored || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

export function incrementPostViewCount(slug: string) {
  if (!isClientSide() || !slug) return 0;

  const sessionKey = `${SESSION_VIEW_PREFIX}${slug}`;
  const countKey = `${VIEW_COUNT_PREFIX}${slug}`;
  const current = getPostViewCount(slug);

  if (window.sessionStorage.getItem(sessionKey)) {
    return current;
  }

  const next = current + 1;
  window.localStorage.setItem(countKey, String(next));
  window.sessionStorage.setItem(sessionKey, "1");
  window.dispatchEvent(new CustomEvent(VIEW_COUNT_EVENT, {
    detail: { slug, count: next },
  }));
  return next;
}

export function subscribeToPostViewCount(
  slug: string,
  onChange: (count: number) => void,
) {
  if (!isClientSide() || !slug) return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== `${VIEW_COUNT_PREFIX}${slug}`) return;
    onChange(getPostViewCount(slug));
  };

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ slug?: string; count?: number }>).detail;
    if (detail?.slug !== slug) return;
    onChange(Number(detail.count) || 0);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(VIEW_COUNT_EVENT, handleCustom as EventListener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(VIEW_COUNT_EVENT, handleCustom as EventListener);
  };
}
