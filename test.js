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
    const response = await fetch('/api/files');
    const files = await response.json();

    const parent = document.getElementById('listaArchivos');
    if (files.length > 0) {
        parent.textContent = '';
        files.forEach(file => {
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
    const progress = document.getElementById('progreso');

    if (fileInput.files.length > 0) {
        progress.style.opacity = '1'
        if (fileInput.files.length > 0){
            await uploadWithFetch(fileInput.files[0]);
        }
    }
});


async function uploadWithFetch(file) {
    const porcentaje = document.getElementById('porcentaje');
    const velocidad = document.getElementById('velocidad');
    const orbita = document.getElementById('orbita');

    orbita.style.opacity = '1'
    const totalSize = file.size;
    let uploaded = 0;
    let lastUpdateTime = 0;
    const startTime = Date.now();
  
    const stream = file.stream();
    const reader = stream.getReader();
  
    const uploadStream = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
  
          uploaded += value.length;
  
          const currentTime = Date.now();
          if (currentTime - lastUpdateTime >= 1000) {
            const percent = (uploaded / totalSize) * 100;
            porcentaje.textContent = `Subiendo: ${percent.toFixed(2)}%`;
  
            const timeElapsed = (currentTime - startTime) / 1000;
            const speed = uploaded / timeElapsed;
  
            if (speed > (1024 * 1024)) {
              velocidad.textContent = `Velocidad: ${(speed / 1024 / 1024).toFixed(2)} MB/s`;
            } else if (speed > 1024) {
              velocidad.textContent = `Velocidad: ${(speed / 1024).toFixed(2)} KB/s`;
            } else {
              velocidad.textContent = `Velocidad: ${speed.toFixed(2)} B/s`;
            }
  
            lastUpdateTime = currentTime;
          }
  
          controller.enqueue(value);
        }
  
        controller.close();
      }
    });
  
    const formBoundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const headers = {
      "Content-Type": `multipart/form-data; boundary=${formBoundary}`
    };
  
    const preamble = `--${formBoundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
      `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  
    const ending = `\r\n--${formBoundary}--\r\n`;
  
    const bodyStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(preamble));
  
        const reader = uploadStream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
  
        controller.enqueue(new TextEncoder().encode(ending));
        orbita.style.opacity = '0'
        controller.close();
      }
    });
  
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: bodyStream,
        duplex: 'half',
        headers: headers
      });
  
      const result = await response.json();
      porcentaje.textContent = result.message || 'Archivo subido con éxito';
      velocidad.textContent = '';
    } catch (err) {
      console.error(err);
      porcentaje.textContent = 'Error al subir el archivo (timeout o conexión)';
      velocidad.textContent = '';
    }
  }