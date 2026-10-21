import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '../components/ui';

// BarcodeDetector ainda não está nos tipos do TypeScript.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
export const cameraScanSupported = Boolean(Detector && navigator.mediaDevices?.getUserMedia);

/**
 * Leitor de QR Code pela câmera usando a API nativa BarcodeDetector (Chrome, Edge, Android).
 * Em navegadores sem suporte, a tela de check-in oferece digitação manual do código.
 */
export function QrScanner({ onScan, paused }: { onScan: (value: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  onScanRef.current = onScan;
  pausedRef.current = paused;

  useEffect(() => {
    if (!active || !Detector) return;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;
    let last = { value: '', at: 0 };
    const detector = new Detector({ formats: ['qr_code'] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async () => {
          if (stopped) return;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && !pausedRef.current) {
            try {
              const [code] = await detector.detect(video);
              const now = Date.now();
              // Evita reenviar o mesmo QR enquanto ele continua na frente da câmera.
              if (code?.rawValue && (code.rawValue !== last.value || now - last.at > 4000)) {
                last = { value: code.rawValue, at: now };
                onScanRef.current(code.rawValue);
              }
            } catch {
              /* quadro ilegível: tenta no próximo */
            }
          }
          timer = window.setTimeout(tick, 250);
        };
        void tick();
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera no navegador para ler os QR Codes.'
            : 'Não foi possível abrir a câmera.',
        );
        setActive(false);
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  if (!cameraScanSupported) {
    return (
      <Alert tone="info" title="Leitura pela câmera indisponível neste navegador">
        Use o Chrome ou Edge (inclusive no Android), ou digite o código do ingresso abaixo.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger" title={error} />}
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-border bg-black">
        {/* Vídeo da câmera sem áudio: não há legenda a oferecer. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className={active ? 'size-full object-cover' : 'hidden'} muted playsInline aria-label="Visualização da câmera" />
        {!active && (
          <div className="flex size-full items-center justify-center p-6 text-center text-sm text-white/80">
            A câmera está desligada.
          </div>
        )}
        {active && <div aria-hidden="true" className="pointer-events-none absolute inset-10 rounded-xl border-2 border-white/70" />}
      </div>
      <Button variant={active ? 'secondary' : 'primary'} onClick={() => { setError(null); setActive((a) => !a); }}>
        {active ? 'Desligar câmera' : 'Ligar câmera'}
      </Button>
    </div>
  );
}
