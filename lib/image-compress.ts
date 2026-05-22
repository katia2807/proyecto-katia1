/**
 * Comprime y redimensiona una imagen en el lado del cliente usando HTML5 Canvas.
 * Limita el ancho/alto máximo a 1200px para no saturar el almacenamiento
 * y la exporta como image/jpeg con calidad 0.75.
 */
export async function compressImage(file: File): Promise<File> {
  // Si no es una imagen compresible (por ejemplo, es un PDF o GIF animado), devolver el original
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // Fallback al original si no hay contexto canvas
          return;
        }

        // Dibujar la imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a Blob (JPEG a 75% calidad para excelente relación calidad/peso)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            // Cambiar la extensión a .jpg ya que exportamos como JPEG
            const originalName = file.name.replace(/\.[^/.]+$/, "");
            const newName = `${originalName || "image"}.jpg`;
            const compressedFile = new File([blob], newName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = () => resolve(file); // Fallback
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file); // Fallback
    reader.readAsDataURL(file);
  });
}
