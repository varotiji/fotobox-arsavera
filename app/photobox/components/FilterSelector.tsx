"use client";

export type FilterType =
  | "none"
  | "grayscale"
  | "vintage"
  | "cool"
  | "warm"
  | "dramatic"
  | "kawaii"
  | "soft-pink"
  | "dreamy"
  | "peach"
  | "cool-blue";

export const FILTERS: { id: FilterType; label: string; emoji: string }[] = [
  { id: "none",      label: "Original",  emoji: "🎨" },
  { id: "grayscale", label: "B&W",       emoji: "⬛" },
  { id: "vintage",   label: "Vintage",   emoji: "🟤" },
  { id: "cool",      label: "Cool",      emoji: "🔵" },
  { id: "warm",      label: "Warm",      emoji: "🟠" },
  { id: "dramatic",  label: "Drama",     emoji: "🖤" },
  { id: "kawaii",    label: "Kawaii",    emoji: "🌸" },
  { id: "soft-pink", label: "Soft Pink", emoji: "🩷" },
  { id: "dreamy",    label: "Dreamy",    emoji: "✨" },
  { id: "peach",     label: "Peach",     emoji: "🍑" },
  { id: "cool-blue", label: "Ice Blue",  emoji: "🧊" },
];

interface FilterSelectorProps {
  current: FilterType;
  onChange: (f: FilterType) => void;
}

export default function FilterSelector({ current, onChange }: FilterSelectorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
        Filter
      </p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {FILTERS.map((f) => {
          const isActive = current === f.id;
          return (
            <button
              key={f.id}
              id={`filter-${f.id}`}
              onClick={() => onChange(f.id)}
              title={f.label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "8px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s", border: "none",
                flexShrink: 0, // Mencegah tombol mengecil, memaksanya scroll horizontal
                minWidth: "64px",
                background: isActive
                  ? "linear-gradient(135deg, var(--accent), var(--accent2))"
                  : "rgba(255,255,255,0.05)",
                color: isActive ? "#fff" : "var(--text-secondary)",
                transform: isActive ? "scale(1.08)" : "scale(1)",
                boxShadow: isActive ? "0 0 14px var(--accent-glow)" : "none",
                outline: isActive ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontSize: 18 }}>{f.emoji}</span>
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
