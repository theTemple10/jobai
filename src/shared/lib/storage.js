// Keep existing device keys across the rebrand so returning users retain work.
export function readStored(key, fallback, validate = () => true, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value !== null && validate(value) ? value : fallback;
  } catch { return fallback; }
}

export function writeStored(key, value, storage = localStorage) {
  storage.setItem(key, JSON.stringify(value));
}

export function readActivity() {
  return readStored('jobai_applications', [], Array.isArray)
    .filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string')
    .map(item => ({...item, status: item.status === 'submitted' ? 'submitted' : 'opened'}));
}

export function readJobProfile(normalize) {
  try { return normalize(readStored('jobai_profile', null)); } catch { return null; }
}
