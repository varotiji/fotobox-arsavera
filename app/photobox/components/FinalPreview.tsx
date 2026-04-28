"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { FilterType } from "./FilterSelector";

const filterStyleMap: Record<FilterType, string> = {
  none:      "none",
  grayscale: "grayscale(100%)",
  vintage:   "sepia(60%) contrast(1.1) brightness(0.95) saturate(0.9)",
  cool:      "hue-rotate(30deg) saturate(1.2) brightness(1.05)",
  warm:      "sepia(30%) saturate(1.3) brightness(1.05)",
  dramatic:  "contrast(1.4) brightness(0.9) saturate(0.8)",
  kawaii:    "brightness(1.1) saturate(1.3) hue-rotate(10deg)",
  "soft-pink": "sepia(20%) saturate(1.4) hue-rotate(-20deg)",
  dreamy:    "blur(1px) brightness(1.1)",
  peach:     "sepia(30%) saturate(1.2) hue-rotate(-10deg)",
  "cool-blue": "hue-rotate(180deg) saturate(1.2)",
};

// Applies filter to an image and returns a new data URL
async function applyFilterToImage(
  src: string,
  filterStr: string,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.filter = filterStr;

      // Object-fit: cover logic
      const imgRatio = img.width / img.height;
      const targetRatio = width / height;

      let sWidth = img.width;
      let sHeight = img.height;
      let sx = 0;
      let sy = 0;

      if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
      ctx.filter = "none";
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.src = src;
  });
}

interface FinalPreviewProps {
  photos: (string | null)[];
  filter: FilterType;
  onClose: () => void;
  onRetakeAll: () => void;
}

export default function FinalPreview({ photos, filter, onClose, onRetakeAll }: FinalPreviewProps) {
  const stripCanvasRef = useRef<HTMLCanvasElement>(null);
  const [stripDataUrl, setStripDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [downloadName] = useState(
    () => `fotobox_strip_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`
  );

  // Generate the photo strip canvas
  useEffect(() => {
    const generate = async () => {
      setIsGenerating(true);

      const validPhotos = photos.filter(Boolean) as string[];
      if (validPhotos.length === 0) {
        setIsGenerating(false);
        return;
      }

      const PHOTO_W = 640;
      const PHOTO_H = 480;
      const PADDING = 20;
      const LABEL_H = 32;
      const GAP = 12;
      const STRIP_W = PHOTO_W + PADDING * 2;
      const STRIP_H =
        PADDING + // top padding
        LABEL_H + // header
        GAP +
        validPhotos.length * (PHOTO_H + GAP) + // photos
        PADDING; // bottom padding

      const canvas = stripCanvasRef.current;
      if (!canvas) return;
      canvas.width = STRIP_W;
      canvas.height = STRIP_H;

      const ctx = canvas.getContext("2d")!;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, STRIP_W, STRIP_H);

      // Header label
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, STRIP_W, LABEL_H + PADDING);
      ctx.fillStyle = "#c084fc";
      ctx.font = "bold 16px 'Inter', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✦ FOTOBOX ✦", STRIP_W / 2, PADDING / 2 + LABEL_H / 2);

      const filterStr = filterStyleMap[filter];

      // Draw each photo
      for (let i = 0; i < validPhotos.length; i++) {
        const filteredDataUrl = await applyFilterToImage(
          validPhotos[i],
          filterStr,
          PHOTO_W,
          PHOTO_H
        );

        const img = document.createElement("img");
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.src = filteredDataUrl;
        });

        const y = PADDING + LABEL_H + GAP + i * (PHOTO_H + GAP);
        ctx.drawImage(img, PADDING, y, PHOTO_W, PHOTO_H);

        // Subtle border around photo
        ctx.strokeStyle = "rgba(168,85,247,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(PADDING, y, PHOTO_W, PHOTO_H);
      }

      // Footer
      const footerY = STRIP_H - PADDING;
      ctx.fillStyle = "rgba(168,85,247,0.7)";
      ctx.font = "11px 'Inter', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), STRIP_W / 2, footerY);

      setStripDataUrl(canvas.toDataURL("image/png"));
      setIsGenerating(false);
    };

    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, filter]);

  return (
    <div
      id="final-preview-modal"
      className="slide-up"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(10,10,20,0.92)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      {/* Hidden canvas used for generation */}
      <canvas ref={stripCanvasRef} style={{ display: "none" }} />

      <div
        className="glass-strong"
        style={{
          borderRadius: 24,
          padding: "28px 24px",
          maxWidth: 480,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          boxShadow: "0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.2)",
        }}
      >
        {/* Title */}
        <div className="text-center">
          <h2
            className="glow-text"
            style={{
              fontSize: 22,
              fontWeight: 800,
              background: "linear-gradient(135deg, var(--accent-light), var(--accent2))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: 4,
            }}
          >
            ✦ Your Photo Strip ✦
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            All 3 photos captured — download or retake.
          </p>
        </div>

        {/* Strip preview */}
        <div className="strip-preview" style={{ maxWidth: 320, margin: "0 auto", width: "100%" }}>
          {isGenerating ? (
            <div
              className="shimmer-skeleton"
              style={{ width: "100%", aspectRatio: "640/1584", borderRadius: 8 }}
            />
          ) : stripDataUrl ? (
            <Image
              src={stripDataUrl}
              alt="Your photo strip"
              width={320}
              height={Math.round(320 * (1584 / 640))}
              style={{ width: "100%", height: "auto", display: "block" }}
              unoptimized
            />
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Download */}
          {stripDataUrl && !isGenerating && (
            <a
              id="download-strip-btn"
              href={stripDataUrl}
              download={downloadName}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 24px",
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
                boxShadow: "0 0 20px var(--accent-glow)",
                transition: "opacity 0.2s, transform 0.15s",
              }}
              className="hover:opacity-90 active:scale-95"
            >
              <span>⬇</span>
              Download PNG
            </a>
          )}

          {/* Divider */}
          <div style={{ display: "flex", gap: 10 }}>
            {/* Back to camera */}
            <button
              id="back-to-camera-btn"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              className="hover:bg-white/10"
            >
              ← Back
            </button>

            {/* Retake all */}
            <button
              id="retake-all-btn"
              onClick={onRetakeAll}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(244,63,94,0.12)",
                border: "1px solid rgba(244,63,94,0.25)",
                color: "#f43f5e",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              className="hover:bg-rose-500/20"
            >
              🔄 Retake All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
