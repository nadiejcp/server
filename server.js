const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIPv4();
const app = express();
const PORT = 3000;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'Archivos')); 
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10 GB limit
  }, 
});

app.use(express.static(__dirname));

app.use((req, res, next) => {
    req.setTimeout(2 * 60 * 60 * 1000); // 2 hours timeout
    next();
});

app.post('/upload', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        print('limit size')
        return res.status(413).json({ success: false, message: 'File too large' });
      }
      print('other')
      print(err.message)
      print(err)
      return res.status(500).json({ success: false, message: err.message });
    } else if (err) {
      print('upload error')
      print(err)
      print(err.message)
      return res.status(500).json({ success: false, message: 'Upload error' });
    } else {
      print('here')
      print(err)
      print(err.message)
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    res.json({ success: true, message: `Archivo cargado` });
  });
});

app.get('/api/files', (req, res) => {
    const directoryPath = path.join(__dirname, 'Archivos');

    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'No se pudieron leer los archivos' });
        }
        res.json(files);
    });
});

const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://${localIP}:${PORT}`);
});
server.setTimeout(2 * 60 * 60 * 1000); // 2 hours