const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 2525;

const cors = require('cors');

app.use(cors());

// Configuración de multer para almacenar los archivos en la carpeta "archivos"
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'archivos'));
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'files'))); // Sirve los archivos de la carpeta "files"

// Ruta para obtener la lista de archivos en la carpeta "archivos"
app.get('/api/files', (req, res) => {
    fs.readdir(path.join(__dirname, 'archivos'), (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'No se pudieron leer los archivos' });
        }
        res.json(files); // Envia la lista de archivos al frontend
    });
});

// Ruta para subir un archivo a la carpeta "archivos"
app.post('/upload', upload.single('file'), (req, res) => {
    req.file.path = req.file.destination + req.file.originalname
    res.json({ message: 'Archivo subido con éxito' });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
