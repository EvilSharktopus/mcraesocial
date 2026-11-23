// Rasterise an on-screen SVG as it currently looks (theme included) and hand
// it to the student as a PNG. The SVG must carry literal colours, not CSS
// variables — see hooks/useThemeColors.js.
export function exportMapPng(svgEl, filename, scale = 2) {
  return new Promise((resolve, reject) => {
    if (!svgEl) { reject(new Error('No map on screen')); return; }
    const { width, height } = svgEl.viewBox.baseVal;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale; canvas.height = height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Could not make the image')); return; }
        const a = document.createElement('a');
        const href = URL.createObjectURL(blob);
        a.href = href; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not render the map')); };
    img.src = url;
  });
}
