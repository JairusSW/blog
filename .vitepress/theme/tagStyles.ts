export function tagStyle(tag: string, overrides: Record<string, string> = {}) {
  const key = tag.toLowerCase();
  const color = overrides[key];
  if (color) {
    return {
      backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
      borderColor: `color-mix(in srgb, ${color} 42%, var(--vp-c-divider))`,
      color,
    };
  }

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsla(${hue}, 78%, 52%, 0.12)`,
    borderColor: `hsla(${hue}, 78%, 52%, 0.32)`,
    color: `hsl(${hue}, 80%, 68%)`,
  };
}
