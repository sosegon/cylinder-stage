/** Read an image into a flat RGB buffer, once. Bars sample this at random. */
export function loadPalette(url) {
  return fetch(url)
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) => (blob ? decode(blob) : null))
    .catch(() => null);
}

function decode(blob) {
  const image = new Image();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(pixelsFrom(image));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

function pixelsFrom(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, image.width, image.height).data;
  const count = image.width * image.height;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const pixel = i * 4;
    colors[i * 3] = data[pixel] / 255;
    colors[i * 3 + 1] = data[pixel + 1] / 255;
    colors[i * 3 + 2] = data[pixel + 2] / 255;
  }
  return colors;
}
