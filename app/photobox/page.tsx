"use client";

import { useState, useRef, useCallback } from "react";
import CameraView, { type CameraViewHandle } from "./components/CameraView";
import PhotoStrip from "./components/PhotoStrip";
import FilterSelector, { type FilterType } from "./components/FilterSelector";
import FinalPreview from "./components/FinalPreview";

const TOTAL_PHOTOS = 3;
const COUNTDOWN_FROM = 3;

type AppPhase = "camera" | "complete";

function wait(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

export default function PhotoboxPage() {
  const cameraRef = useRef<CameraViewHandle>(null);

  const [photos, setPhotos] = useState<(string | null)[]>(Array(TOTAL_PHOTOS).fill(null));
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [filter, setFilter] = useState<FilterType>("none");
  const [phase, setPhase] = useState<AppPhase>("camera");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const runCountdownAndCapture = useCallback(async () => {
    if (isShooting || !cameraReady) return;
    setIsShooting(true);

    for (let i = COUNTDOWN_FROM; i >= 1; i--) {
      setCountdown(i);
      await wait(900);
    }
    setCountdown(null);

    setIsCapturing(true);
    await wait(60);
    const dataUrl = cameraRef.current?.captureFrame() ?? null;
    await wait(340);
    setIsCapturing(false);

    if (dataUrl) {
      setPhotos((prev) => {
        const next = [...prev];
        next[activeSlot] = dataUrl;
        const filledCount = next.filter(Boolean).length;
        if (filledCount === TOTAL_PHOTOS) {
          setTimeout(() => setPhase("complete"), 400);
        } else {
          const nextEmpty = next.findIndex((p) => p === null);
          if (nextEmpty !== -1) setActiveSlot(nextEmpty);
        }
        return next;
      });
    }

    setIsShooting(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShooting, cameraReady, activeSlot]);

  const handleSlotClick = (index: number) => {
    if (!isShooting) setActiveSlot(index);
  };

  const handleDeletePhoto = (index: number) => {
    if (isShooting) return;
    setPhotos((prev) => { const n = [...prev]; n[index] = null; return n; });
    setActiveSlot(index);
  };

  const handleRetakeAll = () => {
    setPhotos(Array(TOTAL_PHOTOS).fill(null));
    setActiveSlot(0);
    setPhase("camera");
  };

  const handleCloseFinal = () => {
    setPhase("camera");
    setPhotos((prev) => {
      const firstEmpty = prev.findIndex((p) => p === null);
      setActiveSlot(firstEmpty === -1 ? 0 : firstEmpty);
      return prev;
    });
  };

  const filledCount = photos.filter(Boolean).length;
  const allFilled = filledCount === TOTAL_PHOTOS;
  const canCapture = !isShooting && cameraReady && !allFilled;

  return (
    <div className="photobooth-bg" style={{ minHeight: "100vh" }}>
      {/* HEADER */}
      <header style={{
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        background: "rgba(13,13,20,0.7)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 0 14px var(--accent-glow)",
          }}>📷</div>
          <div>
            <h1 style={{
              fontSize: 18, fontWeight: 800,
              background: "linear-gradient(135deg, var(--accent-light), var(--accent2))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", lineHeight: 1.1,
            }}>FotoBox</h1>
            <p style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>
              Photobooth Studio
            </p>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(168,85,247,0.1)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 99, padding: "5px 12px",
        }}>
          <span style={{ fontSize: 13, color: "var(--accent-light)", fontWeight: 700 }}>
            {filledCount}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>/ 3 photos</span>
        </div>
      </header>

      {/* MAIN */}
      <main style={{
        maxWidth: 720, margin: "0 auto",
        padding: "24px 16px 80px",
        display: "flex", flexDirection: "column", gap: 24,
      }}>
        {/* Camera card */}
        <div className="glass" style={{ borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: cameraReady ? "#22d3ee" : "#6b7280",
                boxShadow: cameraReady ? "0 0 8px #22d3ee" : "none",
                transition: "all 0.3s",
              }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                {cameraReady ? "Live" : "Connecting…"}
              </span>
            </div>
            <span style={{
              fontSize: 11, color: "var(--text-secondary)",
              background: "rgba(255,255,255,0.05)",
              padding: "3px 8px", borderRadius: 6,
            }}>Slot {activeSlot + 1} of 3</span>
          </div>

          <CameraView
            ref={cameraRef}
            filter={filter}
            countdown={countdown}
            isCapturing={isCapturing}
            onReady={setCameraReady}
          />

          {/* Capture row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "4px 0" }}>
            {/* Slot dots */}
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {photos.map((p, i) => (
                <div key={i} style={{
                  width: i === activeSlot ? 20 : 8, height: 8, borderRadius: 99,
                  background: p
                    ? "linear-gradient(90deg, var(--accent), var(--accent2))"
                    : i === activeSlot ? "var(--accent)" : "rgba(255,255,255,0.12)",
                  transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                }} />
              ))}
            </div>

            {/* Capture button */}
            <button
              id="capture-btn"
              className={`capture-btn${canCapture && !isShooting ? " pulsing" : ""}`}
              onClick={runCountdownAndCapture}
              disabled={!canCapture}
              aria-label="Capture photo"
            />

            {/* View Strip */}
            <button
              id="view-strip-btn"
              onClick={() => setPhase("complete")}
              disabled={!allFilled}
              style={{
                padding: "8px 14px", borderRadius: 10,
                background: allFilled
                  ? "linear-gradient(135deg, var(--accent), var(--accent2))"
                  : "rgba(255,255,255,0.05)",
                border: "none",
                color: allFilled ? "#fff" : "rgba(255,255,255,0.2)",
                fontSize: 12, fontWeight: 700,
                cursor: allFilled ? "pointer" : "not-allowed",
                transition: "all 0.2s", whiteSpace: "nowrap",
                boxShadow: allFilled ? "0 0 14px var(--accent-glow)" : "none",
              }}
            >View Strip →</button>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
            {isShooting
              ? "📸 Get ready…"
              : allFilled
              ? "✨ All 3 photos captured! Click \"View Strip\" to finish."
              : `Take photo ${filledCount + 1} of 3 — click the button above`}
          </p>
        </div>

        {/* Filter */}
        <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
          <FilterSelector current={filter} onChange={setFilter} />
        </div>

        {/* Photo slots */}
        <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
          <PhotoStrip
            photos={photos}
            activeSlot={activeSlot}
            filter={filter}
            onSlotClick={handleSlotClick}
            onDelete={handleDeletePhoto}
          />
          {photos[activeSlot] && (
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
              <button
                id="retake-slot-btn"
                onClick={() => handleDeletePhoto(activeSlot)}
                style={{
                  padding: "8px 18px", borderRadius: 10,
                  background: "rgba(244,63,94,0.1)",
                  border: "1px solid rgba(244,63,94,0.25)",
                  color: "#f43f5e", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >🔄 Retake Photo {activeSlot + 1}</button>
            </div>
          )}
        </div>
      </main>

      {phase === "complete" && (
        <FinalPreview
          photos={photos}
          filter={filter}
          onClose={handleCloseFinal}
          onRetakeAll={handleRetakeAll}
        />
      )}
    </div>
  );
}
