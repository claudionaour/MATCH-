const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 260_000;
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

function isLikelyImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  if (file.name && IMAGE_EXT_REGEX.test(file.name)) return true;
  // Some mobile gallery providers omit MIME type and extension; allow decode attempt if type is empty
  return !file.type;
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer el archivo como imagen.'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer la imagen desde el dispositivo.'));
    reader.readAsDataURL(file);
  });
}

async function decodeImageElement(file: File): Promise<HTMLImageElement> {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await loadImageFromSrc(objectUrl);
    } catch {
      // Fallback to FileReader below
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  return await loadImageFromSrc(rawDataUrl);
}

/**
 * Lee y comprime una imagen seleccionada desde la galería de cualquier dispositivo
 * (Android, iOS, tablet o computador) devolviendo un Data URL JPEG liviano compatible con Firestore.
 */
export async function processGalleryImageFile(file: File): Promise<string> {
  if (!isLikelyImageFile(file)) {
    throw new Error('El archivo seleccionado no es una imagen válida (usa JPG, PNG o WEBP).');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('La imagen supera el máximo permitido de 20 MB.');
  }

  let img: HTMLImageElement;
  try {
    img = await decodeImageElement(file);
  } catch {
    throw new Error(
      'No se pudo procesar este formato de imagen en tu navegador. Intenta con una foto JPG o PNG desde tu galería.'
    );
  }

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  if (!srcWidth || !srcHeight) {
    throw new Error('La imagen seleccionada está vacía o dañada.');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no permite procesar imágenes en este momento.');
  }

  const maxSides = [900, 720, 560, 440];
  const qualities = [0.82, 0.72, 0.6, 0.48];

  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
  }

  throw new Error('No fue posible reducir el tamaño de la imagen. Prueba con otra fotografía.');
}
