import fs from 'fs/promises';
import path from 'path';

// Directory where member photos are stored (matches router behavior)
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

function toLocalPath(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    // Support absolute URLs and root-relative paths.
    // When served, uploads are exposed under `/static/uploads/<filename>`.
    const normalized = url.trim();
    // If it's a full URL, extract pathname
    let pathname;
    if (/^https?:\/\//i.test(normalized)) {
      const u = new URL(normalized);
      pathname = u.pathname;
    } else {
      pathname = normalized;
    }
    // Accept paths like `/static/uploads/...` or `/uploads/...`
    const rel = pathname.replace(/^\/static\//, '').replace(/^\//, '');
    const candidate = path.join(process.cwd(), 'public', rel);
    const resolved = path.resolve(candidate);
    // Ensure the resolved path is inside uploadsDir
    if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep)) return null;
    return resolved;
  } catch (e) {
    return null;
  }
}

export async function safeUnlink(url) {
  try {
    const p = toLocalPath(url);
    if (!p) return false;
    // ensure file exists before unlinking
    try {
      await fs.access(p);
    } catch (e) {
      // file doesn't exist
      return false;
    }
    await fs.unlink(p);
    return true;
  } catch (err) {
    // swallow errors but surface false so callers may log
    return false;
  }
}

export function isLocalUpload(url) {
  return toLocalPath(url) !== null;
}
