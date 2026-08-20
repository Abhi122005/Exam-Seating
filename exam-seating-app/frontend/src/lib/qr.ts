import qrcode from "qrcode-generator";

export function qrSvg(text: string, size = 180, margin = 2): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const cells = qr.getModuleCount();
  const cellSize = Math.max(1, Math.floor(size / (cells + margin * 2)));
  const dim = (cells + margin * 2) * cellSize;
  const rects: string[] = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (qr.isDark(r, c)) {
        rects.push(
          `<rect x="${(c + margin) * cellSize}" y="${(r + margin) * cellSize}" width="${cellSize}" height="${cellSize}"/>`,
        );
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code">${rects.join("")}</svg>`;
}
