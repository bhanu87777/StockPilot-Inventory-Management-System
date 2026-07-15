"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductRow } from "@/lib/inventory";

// Camera scanning via the built-in BarcodeDetector Web API — no dependency.
// Feature-detected: Chromium ships it; elsewhere we point at the USB/typed
// path, which always works.

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export function CameraScanModal({
  products,
  onMatch,
  onClose,
}: {
  products: ProductRow[];
  onMatch: (p: ProductRow) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Ctor({ formats: ["code_128", "ean_13", "qr_code"] });
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const code = codes[0].rawValue.trim().toUpperCase();
              const product = products.find(
                (p) => (p.barcode ?? "").toUpperCase() === code || p.sku.toUpperCase() === code
              );
              if (product) {
                onMatch(product);
                onClose();
              }
            }
          } catch {
            // detection hiccup on a single frame — keep polling
          }
        }, 150);
      } catch {
        setError("Camera unavailable — check permissions, or use a USB scanner / type the SKU.");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [supported, products, onMatch, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={onClose}>
      <div className="panel w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">Scan with camera</h2>
        {!supported ? (
          <p className="text-sm text-ink-secondary">
            Camera scanning needs Chrome or Edge (the BarcodeDetector API). Use a USB scanner or type the SKU into the
            scan box instead.
          </p>
        ) : error ? (
          <p className="text-sm text-critical">{error}</p>
        ) : (
          <>
            <video ref={videoRef} className="aspect-video w-full rounded-lg border border-border bg-black object-cover" muted playsInline />
            <p className="text-xs text-muted">Point at a Code 128 label — it fills the form the moment it reads.</p>
          </>
        )}
        <button onClick={onClose} className="btn-ghost w-full rounded-lg px-4 py-2 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}
