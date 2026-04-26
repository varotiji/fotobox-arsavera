"use client";

export type StripTheme = "A" | "B";

interface PhotoStripTemplateProps {
  images: (string | null)[];
  theme: StripTheme;
}

const THEME_B_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6"];

function ThemeABackground({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundImage: "repeating-conic-gradient(#1c1c1c 0% 25%, #f0f0f0 0% 50%)",
      backgroundSize: "20px 20px",
      padding: "18px 14px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      width: "100%",
    }}>
      {children}
    </div>
  );
}

function ThemeBBackground({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "repeating-linear-gradient(60deg,#ef4444 0,#ef4444 26px,#f97316 26px,#f97316 52px,#eab308 52px,#eab308 78px,#22c55e 78px,#22c55e 104px,#3b82f6 104px,#3b82f6 130px,#8b5cf6 130px,#8b5cf6 156px)",
      padding: "18px 14px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      width: "100%",
    }}>
      {children}
    </div>
  );
}

export default function PhotoStripTemplate({ images, theme }: PhotoStripTemplateProps) {
  const Frame = theme === "A" ? ThemeABackground : ThemeBBackground;

  const brandStyle: React.CSSProperties = theme === "A"
    ? {
        fontFamily: "'Georgia', 'Times New Roman', 'Palatino', serif",
        fontWeight: 900,
        fontSize: "clamp(13px, 3.5vw, 20px)",
        letterSpacing: "0.45em",
        color: "#1c1c1c",
        textTransform: "uppercase",
        textAlign: "center",
        paddingTop: 10,
        background: "rgba(255,255,255,0.82)",
        borderRadius: 4,
        padding: "7px 12px",
      }
    : {
        fontFamily: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif",
        fontWeight: 900,
        fontSize: "clamp(16px, 4.5vw, 26px)",
        letterSpacing: "0.18em",
        color: "#ffffff",
        textTransform: "uppercase",
        textAlign: "center",
        paddingTop: 10,
        textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 3px 6px rgba(0,0,0,0.5)",
        WebkitTextStroke: "0.5px #000",
      };

  return (
    <div
      id="photo-strip-template"
      style={{
        width: "100%",
        background: theme === "A" ? "#f0f0f0" : "#ef4444",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <Frame>
        {images.map((src, i) => (
          <div
            key={i}
            style={{
              borderRadius: 7,
              overflow: "hidden",
              border: "3px solid #ffffff",
              boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
              aspectRatio: "4/3",
              position: "relative",
              background: src ? "#000" : (theme === "A" ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.28)"),
              flexShrink: 0,
            }}
          >
            {src ? (
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 6,
              }}>
                <span style={{
                  fontSize: "clamp(20px, 5vw, 32px)",
                  opacity: 0.3,
                  color: theme === "A" ? "#000" : "#fff",
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 10,
                  opacity: 0.3,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: theme === "A" ? "#000" : "#fff",
                  fontWeight: 600,
                }}>empty</span>
              </div>
            )}
          </div>
        ))}

        {/* ARSAVERA branding */}
        <div style={brandStyle}>ARSAVERA</div>
      </Frame>
    </div>
  );
}

// ---- Canvas generator (for PNG download) ----
const filterMap: Record<string, string> = {
  none:      "none",
  grayscale: "grayscale(100%)",
  vintage:   "sepia(60%) contrast(1.1) brightness(0.95) saturate(0.9)",
  cool:      "hue-rotate(30deg) saturate(1.2) brightness(1.05)",
  warm:      "sepia(30%) saturate(1.3) brightness(1.05)",
  dramatic:  "contrast(1.4) brightness(0.9) saturate(0.8)",
};

async function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, tileSize = 20) {
  for (let row = 0; row < Math.ceil(h / tileSize); row++) {
    for (let col = 0; col < Math.ceil(w / tileSize); col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#1c1c1c" : "#f0f0f0";
      ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
    }
  }
}

function drawDiagonalStripes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const colors = THEME_B_COLORS;
  const diag = Math.ceil(Math.sqrt(w * w + h * h)) + 60;
  const STRIPE = 30;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-60 * Math.PI) / 180);
  const n = Math.ceil(diag / STRIPE) + 2;
  for (let i = -n; i < n; i++) {
    ctx.fillStyle = colors[((i % colors.length) + colors.length) % colors.length];
    ctx.fillRect(i * STRIPE, -diag / 2, STRIPE, diag);
  }
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateStripPng(
  photos: (string | null)[],
  filter: string,
  theme: StripTheme
): Promise<string> {
  const PW = 600;
  const PH = Math.round(PW * (3 / 4)); // 450
  const PAD = 22;
  const GAP = 12;
  const BORDER = 5;
  const BRAND_H = 54;
  const RADIUS = 8;

  const validPhotos = photos.filter((p): p is string => !!p);
  const COUNT = validPhotos.length;

  const STRIP_W = PW + PAD * 2;
  const STRIP_H = PAD + COUNT * (PH + GAP) - (COUNT > 0 ? GAP : 0) + GAP + BRAND_H + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = STRIP_W;
  canvas.height = STRIP_H;
  const ctx = canvas.getContext("2d")!;

  // Background
  if (theme === "A") {
    drawCheckerboard(ctx, STRIP_W, STRIP_H);
  } else {
    drawDiagonalStripes(ctx, STRIP_W, STRIP_H);
  }

  // Photos
  const filterStr = filterMap[filter] ?? "none";
  for (let i = 0; i < COUNT; i++) {
    const Y = PAD + i * (PH + GAP);

    // White border
    ctx.fillStyle = "#ffffff";
    roundedRect(ctx, PAD - BORDER, Y - BORDER, PW + BORDER * 2, PH + BORDER * 2, RADIUS + 2);
    ctx.fill();

    // Draw photo with filter inside rounded rect
    roundedRect(ctx, PAD, Y, PW, PH, RADIUS);
    ctx.save();
    ctx.clip();
    ctx.filter = filterStr;
    const img = await loadImg(validPhotos[i]);
    ctx.drawImage(img, PAD, Y, PW, PH);
    ctx.filter = "none";
    ctx.restore();
  }

  // ARSAVERA branding
  const textY = STRIP_H - PAD - BRAND_H / 2 + 8;

  if (theme === "A") {
    // Elegant white pill background
    const PILL_W = 280;
    const PILL_H = 36;
    const PILL_X = (STRIP_W - PILL_W) / 2;
    const PILL_Y = STRIP_H - PAD - BRAND_H + 6;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    roundedRect(ctx, PILL_X, PILL_Y, PILL_W, PILL_H, 5);
    ctx.fill();

    ctx.fillStyle = "#1c1c1c";
    ctx.font = "bold 18px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "8px";
    ctx.fillText("ARSAVERA", STRIP_W / 2, PILL_Y + PILL_H / 2);
  } else {
    // Impact streetwear style
    ctx.font = "bold 28px Impact, Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Shadow
    ctx.fillStyle = "#000";
    ctx.fillText("ARSAVERA", STRIP_W / 2 + 2, textY + 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("ARSAVERA", STRIP_W / 2, textY);
  }

  return canvas.toDataURL("image/png");
}
