// Small helpers for handing the teacher a file to keep.

// Firestore Timestamps become ISO strings so the file is readable and can be
// re-imported without the SDK.
export function plain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(plain(data), null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const dateStamp = (d = new Date()) => d.toISOString().slice(0, 10);
