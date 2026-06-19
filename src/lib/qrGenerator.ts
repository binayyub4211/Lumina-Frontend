import QRCode from 'qrcode';

export interface QRGenerateOptions {
  /** Data to encode in the QR code */
  data: string;
  /** Canvas element to render into */
  canvas: HTMLCanvasElement;
  /** QR code width in CSS pixels (actual canvas will use devicePixelRatio) */
  width?: number;
  /** QR code error correction level */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** QR foreground colour */
  color?: string;
  /** QR background colour */
  backgroundColor?: string;
}

/**
 * Generates a QR code onto a canvas element with high-DPI support.
 * The canvas internal resolution is scaled by devicePixelRatio for sharp
 * rendering on Retina / HiDPI displays.
 */
export async function renderQRCode(options: QRGenerateOptions): Promise<void> {
  const {
    data,
    canvas,
    width = 280,
    errorCorrectionLevel = 'M',
    color = '#171512',
    backgroundColor = '#ffffff',
  } = options;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const scaledWidth = Math.round(width * dpr);

  canvas.width = scaledWidth;
  canvas.height = scaledWidth;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${width}px`;

  await QRCode.toCanvas(canvas, data, {
    width: scaledWidth,
    margin: 2,
    errorCorrectionLevel,
    color: {
      dark: color,
      light: backgroundColor,
    },
  });
}

/**
 * Encodes a string as a base64url-safe string.
 */
export function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
