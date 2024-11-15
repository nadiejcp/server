const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'Archivos')); // Save files in the "archivos" folder
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use original file name
    }
});

const upload = multer({ storage });

// Serve static files (index.html, CSS, JS) from the same folder as server.js
app.use(express.static(__dirname));

// Route to handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ message: 'Archivo subido con éxito' });
});

// Route to get the list of uploaded files
app.get('/api/files', (req, res) => {
    const directoryPath = path.join(__dirname, 'Archivos');

    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'No se pudieron leer los archivos' });
        }
        res.json(files);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
