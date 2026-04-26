"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react";
import type { FilterType } from "./FilterSelector";

export interface CameraViewHandle {
  captureFrame: () => string | null;
}

interface CameraViewProps {
  filter: FilterType;
  countdown: number | null;
  isCapturing: boolean;
  onReady: (ready: boolean) => void;
}

const filterStyleMap: Record<FilterType, string> = {
  none:      "none",
  grayscale: "grayscale(100%)",
  vintage:   "sepia(60%) contrast(1.1) brightness(0.95) saturate(0.9)",
  cool:      "hue-rotate(30deg) saturate(1.2) brightness(1.05)",
  warm:      "sepia(30%) saturate(1.3) brightness(1.05)",
  dramatic:  "contrast(1.4) brightness(0.9) saturate(0.8)",
};

const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  ({ filter, countdown, isCapturing, onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;
        const W = video.videoWidth  || 640;
        const H = video.videoHeight || 480;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.filter = filterStyleMap[filter];
        ctx.drawImage(video, 0, 0, W, H);
        ctx.filter = "none";
        return canvas.toDataURL("image/jpeg", 0.92);
      },
    }));

    useEffect(() => {
      let stream: MediaStream | null = null;

      const tryConstraints = async (constraints: MediaStreamConstraints) => {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) videoRef.current.srcObject = stream;
        onReady(true);
        setError(null);
      };

      const startCamera = async () => {
        // 1) Try front-facing (user) camera with high resolution
        try {
          await tryConstraints({
            video: {
              facingMode: "user",
              width:  { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          });
          return;
        } catch { /* fallthrough */ }

        // 2) Try any camera with resolution request
        try {
          await tryConstraints({
            video: { width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false,
          });
          return;
        } catch { /* fallthrough */ }

        // 3) Last resort: basic video
        try {
          await tryConstraints({ video: true, audio: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Camera access denied";
          setError(msg);
          onReady(false);
        }
      };

      startCamera();
      return () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const corners = [
      { top: 12, left: 12,  borderTop: "2px solid var(--accent)", borderLeft:  "2px solid var(--accent)", borderRadius: "4px 0 0 0" },
      { top: 12, right: 12, borderTop: "2px solid var(--accent)", borderRight: "2px solid var(--accent)", borderRadius: "0 4px 0 0" },
      { bottom: 12, left: 12,  borderBottom: "2px solid var(--accent)", borderLeft:  "2px solid var(--accent)", borderRadius: "0 0 0 4px" },
      { bottom: 12, right: 12, borderBottom: "2px solid var(--accent)", borderRight: "2px solid var(--accent)", borderRadius: "0 0 4px 0" },
    ];

    return (
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ filter: filterStyleMap[filter] }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Corner decorations */}
        {!error && corners.map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 22, height: 22, opacity: 0.75, ...s }} />
        ))}

        {/* Countdown */}
        {countdown !== null && (
          <div
            key={countdown}
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.4)", zIndex: 10,
            }}
          >
            <span className="countdown-number">{countdown}</span>
          </div>
        )}

        {/* Flash */}
        {isCapturing && (
          <div
            className="capture-flash"
            style={{
              position: "absolute", inset: 0,
              background: "rgba(255,255,255,0.88)",
              zIndex: 20, pointerEvents: "none",
            }}
          />
        )}

        {/* Error */}
        {error && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 12, background: "var(--bg-card)",
            color: "var(--text-secondary)", padding: 24, textAlign: "center",
          }}>
            <span style={{ fontSize: 44 }}>📷</span>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Camera Unavailable
            </p>
            <p style={{ fontSize: 13 }}>{error}</p>
            <p style={{ fontSize: 12, opacity: 0.6 }}>
              Allow camera access in your browser and reload.
            </p>
          </div>
        )}
      </div>
    );
  }
);

CameraView.displayName = "CameraView";
export default CameraView;
