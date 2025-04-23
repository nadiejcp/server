const enlace = 'http://192.168.50.83:3000'

function crearElemento(nombre, source) {
    const node = document.createElement("div");
    node.role = "listitem"
    node.className = "w-dyn-item"

    const a = document.createElement("a")
    a.className = "post-wrapper w-inline-block"
    a.href = "./Archivos/" + nombre

    const div = document.createElement("div")
    div.className = "post-image-wrapper slide-in-bottom-300ms"
    div.style = "opacity: 1; transform: translate3d(0px, 0px, 0px) scale3d(1, 1, 1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) skew(0deg, 0deg); transform-style: preserve-3d;"

    const img = document.createElement("img")
    img.src = source
    img.loading = "lazy"
    img.className = "post-image"

    const div2 = document.createElement("div")
    div2.className = "post-name"
    div2.innerHTML = nombre

    div.appendChild(img)

    a.appendChild(div)
    a.appendChild(div2)

    node.appendChild(a)

    return node
}

function crearEmpty() {
    const p = document.createElement("div")
    p.className = "post-name"
    p.innerHTML = "No hay archivos cargados."
    return p
}

function isImage(text) {
    text = text.toLowerCase();
    return (text.endsWith('png') | text.endsWith('jpg') | text.endsWith('jpeg') | text.endsWith('ico'));
}

function isVideo(text) {
    text = text.toLowerCase();
    return (text.endsWith('mp4') | text.endsWith('mkv'));
}

function isMusic(text) {
    text = text.toLowerCase();
    return (text.endsWith('mp3') | text.endsWith('a4u'));
}

async function fetchFiles() {
    const response = await fetch(enlace + '/api/files');
    const files = await response.json();

    const parent = document.getElementById('listaArchivos');
    if (files.length > 0) {
        parent.textContent = '';
        files.forEach(file => {
            console.log(file)
            if (isMusic(file)) {
                parent.appendChild(crearElemento(file, './Files/music.png'))
            } else if (isImage(file)) {
                parent.appendChild(crearElemento(file, './Archivos/' + file))
            } else if (isVideo(file)) {
                parent.appendChild(crearElemento(file, './Archivos/video.png'))
            } else {
                parent.appendChild(crearElemento(file, './Files/file.png'))
            }
        });
    } else {
        parent.appendChild(crearEmpty());
    }
}

window.onload = fetchFiles();

document.getElementById('file-input').addEventListener('change', async (e) => {
    const fileInput = e.target;
    const progress = document.getElementById('progress');

    if (fileInput.files.length > 0) {
        progress.style.opacity = '1'
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                progress.textContent = `Subiendo: ${Math.round(percent)}%`;
            }
        });

        xhr.onload = () => {
            if (xhr.status === 200) {
                fetchFiles(); 
                fileInput.value = '';
                progress.textContent = '';
                progress.textContent = 'Archivo subido con éxito';
            } else {
                progress.textContent = 'Error al subir el archivo';
            }
        };

        xhr.onerror = () => { 
            progress.style.opacity = '0'
            alert('Hubo un error al subir el archivo');
            progress.textContent = 'Error al subir el archivo';
        };

        xhr.open('POST', enlace + '/upload');
        xhr.send(formData);
    }

});