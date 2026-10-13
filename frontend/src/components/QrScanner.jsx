import { useEffect, useId } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

export default function QrScanner({ onScan }) {
  const id = `qr-reader-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(id, {
      fps: 10,
      qrbox: { width: 240, height: 240 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    }, false);
    scanner.render(onScan, () => {});
    return () => { scanner.clear().catch(() => {}); };
  }, [id, onScan]);

  return <div id={id} className="qr-scanner" aria-label="Camera QR scanner" />;
}
