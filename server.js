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
    fileSize: 100 * 1024 * 1024 * 1024, // 100 GB limit
  }, 
});

app.use(express.static(__dirname));

app.use((req, res, next) => {
    req.setTimeout(2 * 60 * 60 * 1000); // 2 hours timeout
    next();
});

app.post('/upload', (req, res) => {
  console.log('starting')
  upload.single('file')(req, res, function (err) {
     if (err) {
      console.log('Error during file upload');
      console.log(err);
      return res.status(500).json({ success: false, message: err.message });
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