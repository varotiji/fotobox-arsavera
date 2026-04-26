"use client";

import Image from "next/image";
import type { FilterType } from "./FilterSelector";

interface PhotoSlotProps {
  index: number;
  photo: string | null;
  isActive: boolean;
  filter: FilterType;
  onClick: () => void;
  onDelete: () => void;
}

const filterStyleMap: Record<FilterType, string> = {
  none:      "none",
  grayscale: "grayscale(100%)",
  vintage:   "sepia(60%) contrast(1.1) brightness(0.95) saturate(0.9)",
  cool:      "hue-rotate(30deg) saturate(1.2) brightness(1.05)",
  warm:      "sepia(30%) saturate(1.3) brightness(1.05)",
  dramatic:  "contrast(1.4) brightness(0.9) saturate(0.8)",
};

function PhotoSlotItem({ index, photo, isActive, filter, onClick, onDelete }: PhotoSlotProps) {
  return (
    <div
      id={`photo-slot-${index + 1}`}
      className={`photo-slot ${isActive ? "active" : ""} ${photo ? "filled" : ""}`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {photo ? (
        <>
          {/* Thumbnail Image */}
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <Image
              src={photo}
              alt={`Photo ${index + 1}`}
              fill
              style={{ objectFit: "cover", filter: filterStyleMap[filter] }}
              unoptimized
            />
          </div>

          {/* Delete button */}
          <button
            id={`delete-photo-${index + 1}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete photo"
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(244,63,94,0.85)",
              border: "none",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 5,
              transition: "transform 0.15s",
            }}
            className="hover:scale-110"
          >
            ✕
          </button>

          {/* Slot number badge */}
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 5,
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 4,
              zIndex: 5,
            }}
          >
            {index + 1}
          </div>

          {/* Active badge */}
          {isActive && (
            <div className="active-badge">Active</div>
          )}

          {/* Checkmark overlay for filled */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, transparent 60%)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        /* Empty slot */
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {isActive ? (
            <>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  animation: "bounce-soft 1.5s ease-in-out infinite",
                }}
              >
                📷
              </div>
              <span style={{ fontSize: 10, color: "var(--accent-light)", fontWeight: 600 }}>
                Photo {index + 1}
              </span>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "2px dashed rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.2)",
                }}
              >
                {index + 1}
              </div>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
                Empty
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface PhotoStripProps {
  photos: (string | null)[];
  activeSlot: number;
  filter: FilterType;
  onSlotClick: (index: number) => void;
  onDelete: (index: number) => void;
}

export default function PhotoStrip({
  photos,
  activeSlot,
  filter,
  onSlotClick,
  onDelete,
}: PhotoStripProps) {
  const filledCount = photos.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          Photos
        </p>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: photos[i]
                  ? "linear-gradient(135deg, var(--accent), var(--accent2))"
                  : "rgba(255,255,255,0.1)",
                transition: "background 0.3s",
                boxShadow: photos[i] ? "0 0 6px var(--accent-glow)" : "none",
              }}
            />
          ))}
          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 4 }}>
            {filledCount}/3
          </span>
        </div>
      </div>

      {/* 3 Slots */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {photos.map((photo, i) => (
          <PhotoSlotItem
            key={i}
            index={i}
            photo={photo}
            isActive={activeSlot === i}
            filter={filter}
            onClick={() => onSlotClick(i)}
            onDelete={() => onDelete(i)}
          />
        ))}
      </div>

      {/* Progress info */}
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(filledCount / 3) * 100}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent2))",
            borderRadius: 99,
            transition: "width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: "0 0 8px var(--accent-glow)",
          }}
        />
      </div>
    </div>
  );
}
