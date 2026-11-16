const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 5277;
const ROOT_DIR = __dirname;
const ARCHIVOS_DIR = path.join(ROOT_DIR, 'Archivos');

if (!fs.existsSync(ARCHIVOS_DIR)) {
  fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
}

function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address
        });
      }
    }
  }

  addresses.sort((a, b) => {
    const score = (item) => {
      const lower = item.name.toLowerCase();
      if (lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('ethernet') || lower.includes('en0')) {
        return 0;
      }
      if (item.address.startsWith('192.168.') || item.address.startsWith('10.')) {
        return 1;
      }
      return 2;
    };
    return score(a) - score(b);
  });

  return addresses;
}

function getLocalIPv4() {
  const addresses = getNetworkAddresses();
  return addresses.length > 0 ? addresses[0].address : '127.0.0.1';
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'a4u', 'opus']);
const DOC_EXTS = new Set(['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf']);
const CODE_EXTS = new Set(['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'sh', 'ps1', 'xml', 'yml', 'yaml']);
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso']);

function getFileCategory(ext, isDirectory) {
  if (isDirectory) return 'folder';
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  if (IMAGE_EXTS.has(cleanExt)) return 'image';
  if (VIDEO_EXTS.has(cleanExt)) return 'video';
  if (AUDIO_EXTS.has(cleanExt)) return 'audio';
  if (DOC_EXTS.has(cleanExt)) return 'document';
  if (CODE_EXTS.has(cleanExt)) return 'code';
  if (ARCHIVE_EXTS.has(cleanExt)) return 'archive';
  return 'other';
}

function decodeOriginalName(rawName) {
  try {
    const decoded = Buffer.from(rawName, 'latin1').toString('utf8');
    if (decoded.includes('\uFFFD')) {
      return path.basename(rawName);
    }
    return path.basename(decoded);
  } catch {
    return path.basename(rawName);
  }
}

function resolveSafePath(baseDir, relativeTarget = '') {
  const normalized = path.normalize(relativeTarget).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    return null;
  }
  return resolved;
}

const localIP = getLocalIPv4();
const app = express();

app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, ARCHIVOS_DIR);
  },
  filename: function (req, file, cb) {
    const safeName = decodeOriginalName(file.originalname);
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 * 1024
  }
});

app.use(express.static(ROOT_DIR));

app.use((req, res, next) => {
  req.setTimeout(2 * 60 * 60 * 1000);
  next();
});

app.get('/api/info', (req, res) => {
  const ip = getLocalIPv4();
  const interfaces = getNetworkAddresses();
  res.json({
    ip,
    port: PORT,
    url: `http://${ip}:${PORT}`,
    hostname: os.hostname(),
    interfaces
  });
});

app.post('/upload', (req, res) => {
  upload.any()(req, res, function (err) {
    if (err) {
      console.error('Error during file upload:', err);
      return res.status(500).json({ success: false, message: err.message });
    }

    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No se seleccionó ningún archivo' });
    }

    res.json({
      success: true,
      count: uploadedFiles.length,
      files: uploadedFiles.map((f) => f.filename),
      message: uploadedFiles.length === 1
        ? `Archivo "${uploadedFiles[0].filename}" cargado con éxito`
        : `${uploadedFiles.length} archivos cargados con éxito`
    });
  });
});

const IGNORED_REPO_ENTRIES = new Set(['.git', 'node_modules', 'package-lock.json']);

app.get('/api/files', async (req, res) => {
  try {
    const scope = req.query.scope === 'repo' ? 'repo' : 'shared';
    const subDir = typeof req.query.dir === 'string' ? req.query.dir : '';
    const baseDir = scope === 'repo' ? ROOT_DIR : ARCHIVOS_DIR;
    const targetDir = resolveSafePath(baseDir, subDir);

    if (!targetDir || !fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Directorio no encontrado' });
    }

    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      if (scope === 'repo' && IGNORED_REPO_ENTRIES.has(entry.name)) {
        continue;
      }
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(targetDir, entry.name);
      let stat;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch {
        continue;
      }

      const relFromRoot = path.relative(ROOT_DIR, fullPath);
      const relFromScope = path.relative(baseDir, fullPath);
      const isDirectory = stat.isDirectory();
      const ext = isDirectory ? '' : path.extname(entry.name).slice(1).toLowerCase();
      const urlPath = relFromRoot.split(path.sep).map(encodeURIComponent).join('/');
      const scopeUrlPath = relFromScope.split(path.sep).join('/');

      results.push({
        name: entry.name,
        relativePath: relFromRoot.split(path.sep).join('/'),
        scopePath: scopeUrlPath,
        isDirectory,
        size: isDirectory ? 0 : stat.size,
        mtime: stat.mtimeMs,
        ext,
        category: getFileCategory(ext, isDirectory),
        url: `./${urlPath}`,
        downloadUrl: `/api/download?path=${encodeURIComponent(relFromRoot.split(path.sep).join('/'))}`,
        canDelete: scope === 'shared' && !isDirectory
      });
    }

    results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return b.mtime - a.mtime;
    });

    res.json(results);
  } catch (err) {
    console.error('Error reading files:', err);
    res.status(500).json({ error: 'No se pudieron leer los archivos' });
  }
});

app.get('/api/download', (req, res) => {
  const relPath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!relPath) {
    return res.status(400).json({ error: 'Ruta de archivo requerida' });
  }

  const resolved = resolveSafePath(ROOT_DIR, relPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  const relFromRoot = path.relative(ROOT_DIR, resolved);
  const topSegment = relFromRoot.split(path.sep)[0];
  if (topSegment === '.git' || topSegment === 'node_modules') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'No se puede descargar una carpeta directamente' });
  }

  res.download(resolved, path.basename(resolved));
});

app.delete('/api/files', async (req, res) => {
  try {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!relPath) {
      return res.status(400).json({ error: 'Ruta requerida' });
    }

    const resolved = resolveSafePath(ROOT_DIR, relPath);
    if (!resolved || !resolved.startsWith(path.resolve(ARCHIVOS_DIR) + path.sep)) {
      return res.status(403).json({ error: 'Solo se pueden eliminar archivos dentro de la carpeta Archivos' });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const stat = await fs.promises.stat(resolved);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'No se pueden eliminar carpetas desde la interfaz' });
    }

    await fs.promises.unlink(resolved);
    res.json({ success: true, message: 'Archivo eliminado correctamente' });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://${localIP}:${PORT}`);
});
server.setTimeout(2 * 60 * 60 * 1000);
