"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react";
import FilterSelector, { type FilterType } from "./FilterSelector";
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export interface CameraViewHandle {
  captureFrame: () => string | null;
}

interface CameraViewProps {
  filter: FilterType;
  onFilterChange?: (filter: FilterType) => void;
  countdown: number | null;
  isCapturing: boolean;
  onReady: (ready: boolean) => void;
}

const filterStyleMap: Record<FilterType, string> = {
  none: "none",
  grayscale: "grayscale(100%)",
  vintage: "sepia(60%) contrast(1.1) brightness(0.95) saturate(0.9)",
  cool: "hue-rotate(30deg) saturate(1.2) brightness(1.05)",
  warm: "sepia(30%) saturate(1.3) brightness(1.05)",
  dramatic: "contrast(1.4) brightness(0.9) saturate(0.8)",
  kawaii: "brightness(1.1) saturate(1.3) hue-rotate(10deg)",
  "soft-pink": "sepia(20%) saturate(1.4) hue-rotate(-20deg)",
  dreamy: "blur(1px) brightness(1.1)",
  peach: "sepia(30%) saturate(1.2) hue-rotate(-10deg)",
  "cool-blue": "hue-rotate(180deg) saturate(1.2)",
};

interface CleanSticker {
  canvas: HTMLCanvasElement;
  splitRatio: number;
}

// Global cache untuk stiker yang sudah dibersihkan dan dianalisis
const cleanStickerCache = new Map<HTMLImageElement, CleanSticker>();

// FUNGSI ALGORITMA FLOOD-FILL (MAGIC WAND), AUTO-CROP & SMART SPLIT
// 1. Menghapus background putih (Magic Wand)
// 2. Memotong area kosong (Auto-Crop)
// 3. Smart Split: Mencari celah antara telinga dan hidung secara otomatis!
const applyMagicWandAndCrop = (img: HTMLImageElement): CleanSticker => {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { canvas, splitRatio: 0.5 };

  ctx.drawImage(img, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // === 1. MAGIC WAND BACKGROUND REMOVAL ===
    // Hanya proses jika sudut kiri atas tidak transparan
    if (data[3] > 0) {
      const stack = new Uint32Array(canvas.width * canvas.height * 2);
      let stackPtr = 0;
      const push = (x: number, y: number) => { stack[stackPtr++] = x; stack[stackPtr++] = y; };
      const pop = () => { const y = stack[--stackPtr]; const x = stack[--stackPtr]; return [x, y]; };

      push(0, 0);
      push(canvas.width - 1, 0);
      push(0, canvas.height - 1);
      push(canvas.width - 1, canvas.height - 1);

      const visited = new Uint8Array(canvas.width * canvas.height);

      while (stackPtr > 0) {
        const [x, y] = pop();
        const idx = y * canvas.width + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const p = idx * 4;
        // Toleransi warna putih/abu terang (Background)
        if (data[p] > 230 && data[p + 1] > 230 && data[p + 2] > 230) {
          data[p + 3] = 0; // Transparan
          if (x + 1 < canvas.width) push(x + 1, y);
          if (x - 1 >= 0) push(x - 1, y);
          if (y + 1 < canvas.height) push(x, y + 1);
          if (y - 1 >= 0) push(x, y - 1);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  } catch (err) {
    console.error("Canvas Tainted (CORS) during Magic Wand:", err);
    // Jika CORS gagal, kita kembalikan saja canvas aslinya tanpa diproses
    return { canvas, splitRatio: 0.5 };
  }

  // === 2. AUTO CROP (TRIM) ===
  // Mencari Bounding Box dari semua piksel yang tidak transparan
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  let hasPixels = false;

  // Ambil ulang data karena mungkin baru di-magic wand
  const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = currentData[(y * canvas.width + x) * 4 + 3];
      if (alpha > 10) { // Jika piksel terlihat
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return { canvas, splitRatio: 0.5 };

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  let finalCanvas = canvas;
  let finalCtx = ctx;

  // Jika perlu di-crop
  if (cropW !== canvas.width || cropH !== canvas.height) {
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const croppedCtx = croppedCanvas.getContext("2d");
    if (croppedCtx) {
      croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      finalCanvas = croppedCanvas;
      finalCtx = croppedCtx;
    }
  }

  // === 3. SMART SPLIT RATIO ===
  // Mencari baris paling kosong (celah antara telinga dan moncong)
  const finalData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height).data;
  const rowDensity = new Float32Array(finalCanvas.height);
  for (let y = 0; y < finalCanvas.height; y++) {
    let solidCount = 0;
    for (let x = 0; x < finalCanvas.width; x++) {
      if (finalData[(y * finalCanvas.width + x) * 4 + 3] > 10) solidCount++;
    }
    rowDensity[y] = solidCount;
  }

  let bestY = finalCanvas.height / 2;
  if (finalCanvas.height > 20) {
    // BATASI PENCARIAN HANYA DI AREA ATAS (20% - 50%)
    // Ini mencegah sistem mengira ruang kosong di bawah moncong sebagai pemisah!
    const startY = Math.floor(finalCanvas.height * 0.20);
    const endY = Math.floor(finalCanvas.height * 0.50);
    let minDensity = Infinity;
    for (let y = startY; y <= endY; y++) {
      let sum = 0;
      // Window 5 pixels untuk stabilitas
      for (let i = -2; i <= 2; i++) {
        const idx = Math.max(0, Math.min(finalCanvas.height - 1, y + i));
        sum += rowDensity[idx];
      }
      if (sum < minDensity) {
        minDensity = sum;
        bestY = y;
      }
    }
  }

  return { canvas: finalCanvas, splitRatio: bestY / finalCanvas.height };
};

const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  ({ filter, countdown, isCapturing, onReady, onFilterChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const liveOverlayRef = useRef<HTMLCanvasElement>(null);

    const [stickerImgs, setStickerImgs] = useState<Record<string, HTMLImageElement>>({});
    const [showFilters, setShowFilters] = useState(false);
    const [showStickers, setShowStickers] = useState(false);

    const [selectedStickers, setSelectedStickers] = useState<string[]>([]);
    const selectedStickersRef = useRef<string[]>([]);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [debugText, setDebugText] = useState<string>("Debug: Starting...");

    // MediaPipe state & refs
    const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
    const lastVideoTime = useRef(-1);
    const lastResults = useRef<FaceLandmarkerResult | null>(null);
    const requestRef = useRef<number>(null);

    useEffect(() => {
      selectedStickersRef.current = selectedStickers;
    }, [selectedStickers]);

    const toggleSticker = (name: string) => {
      setSelectedStickers((prev) =>
        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      );
    };

    // 1. Preload stiker & Hapus Background (Magic Wand)
    useEffect(() => {
      const names = ["anime", "bear", "bunny", "cat", "crown", "flower", "frog", "glasses", "love", "sparkle"];
      const loaded: Record<string, HTMLImageElement> = {};

      names.forEach((name) => {
        const img = new window.Image();
        img.src = `/stickers/${name}.png`;
        img.onload = () => {
          loaded[name] = img;
          setDebugText(prev => prev + ` | img:${name} OK`);
          // Hapus background putih & Potong area kosong (Auto-Crop)
          if (!cleanStickerCache.has(img)) {
            cleanStickerCache.set(img, applyMagicWandAndCrop(img));
          }
          setStickerImgs(prev => ({ ...prev, [name]: img }));
        };
        img.onerror = () => {
          setDebugText(prev => prev + ` | img:${name} FAIL`);
        };
      });
    }, []);

    // 2. Inisialisasi MediaPipe Face Landmarker
    useEffect(() => {
      let active = true;
      let landmarkerInstance: FaceLandmarker | null = null;

      async function initFaceLandmarker() {
        try {
          setDebugText(prev => prev + " | MP: Fetching...");
          const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          try {
            setDebugText(prev => prev + " | MP: GPU init...");
            landmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "GPU",
              },
              outputFaceBlendshapes: false,
              runningMode: "VIDEO",
              numFaces: 1,
            });
            setDebugText(prev => prev + " | MP: GPU OK");
          } catch (gpuErr: any) {
            console.warn("GPU Delegate failed, falling back to CPU", gpuErr);
            setDebugText(prev => prev + " | MP: GPU FAIL, CPU init...");
            landmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "CPU",
              },
              outputFaceBlendshapes: false,
              runningMode: "VIDEO",
              numFaces: 1,
            });
            setDebugText(prev => prev + " | MP: CPU OK");
          }

          if (active && landmarkerInstance) {
            setFaceLandmarker(landmarkerInstance);
          } else {
            // Jika komponen sudah unmount sebelum selesai loading, buang memori
            landmarkerInstance?.close();
          }
        } catch (err: any) {
          console.error("FaceLandmarker Error:", err);
          setDebugText(prev => prev + ` | MP: FAIL (${err.message})`);
        }
      }
      initFaceLandmarker();
      return () => {
        active = false;
        // Mencegah kebocoran memori WebGL Context (batas browser biasanya 16 context)
        landmarkerInstance?.close();
      };
    }, []);

    // 3. Fungsi Gambar Stiker (Mendukung Pemotongan / Crop untuk Full-Face Filter)
    const drawStickers = (
      ctx: CanvasRenderingContext2D,
      landmarks: { x: number; y: number; z: number }[],
      W: number,
      H: number,
      imgs: Record<string, HTMLImageElement>,
      activeNames: string[]
    ) => {
      const getX = (idx: number) => W - landmarks[idx].x * W;
      const getY = (idx: number) => landmarks[idx].y * H;

      // Kalkulasi Rotasi
      const screenLeftEye = { x: getX(386), y: getY(386) };
      const screenRightEye = { x: getX(159), y: getY(159) };
      const dx = screenRightEye.x - screenLeftEye.x;
      const dy = screenRightEye.y - screenLeftEye.y;
      const angle = Math.atan2(dy, dx);

      // Kalkulasi Lebar Wajah
      const faceLeft = getX(454);
      const faceRight = getX(234);
      const faceWidth = Math.abs(faceRight - faceLeft);

      const drawImg = (
        name: string,
        cx: number, cy: number,
        scaleFactor: number, yOffsetFactor: number,
        crop: "full" | "top" | "bottom" = "full",
        splitRatio: number = 0.5
      ) => {
        const img = imgs[name];
        if (!img || !activeNames.includes(name)) return;

        const cached = cleanStickerCache.get(img);
        const cleanSource = cached ? cached.canvas : img;
        const autoSplitRatio = cached ? cached.splitRatio : 0.5;
        // Jika parameter splitRatio tidak didefinisikan secara manual, gunakan autoSplitRatio
        const finalSplitRatio = splitRatio !== 0.5 ? splitRatio : autoSplitRatio;

        const size = faceWidth * scaleFactor;
        const aspectRatio = cleanSource.height / cleanSource.width;
        let drawWidth = size;
        let drawHeight = size * aspectRatio;

        let sx = 0, sy = 0, sw = cleanSource.width, sh = cleanSource.height;
        let finalDrawHeight = drawHeight;

        // Logika Potong (Crop) Gambar.
        if (crop === "top") {
          sh = cleanSource.height * finalSplitRatio;
          finalDrawHeight = drawHeight * finalSplitRatio;
        } else if (crop === "bottom") {
          sy = cleanSource.height * finalSplitRatio;
          sh = cleanSource.height * (1 - finalSplitRatio);
          finalDrawHeight = drawHeight * (1 - finalSplitRatio);
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        const finalYOffset = finalDrawHeight * yOffsetFactor;
        ctx.translate(0, finalYOffset);

        ctx.drawImage(
          cleanSource,
          sx, sy, sw, sh,
          -drawWidth / 2, -finalDrawHeight / 2, drawWidth, finalDrawHeight
        );
        ctx.restore();
      };

      // --- PENEMPATAN STIKER (SEPERTI FILTER IG) --- //

      const topHeadX = getX(10);
      const topHeadY = getY(10);
      const noseX = getX(1);
      const noseY = getY(1);

      // 1. KELOMPOK TOPI / TELINGA (Dahi)
      drawImg("crown", topHeadX, topHeadY, 1.2, -0.6);
      drawImg("bunny", topHeadX, topHeadY, 1.4, -0.6);
      drawImg("frog", topHeadX, topHeadY, 1.3, -0.5);
      
      // Karena gambar "love" sekarang adalah telinga (bukan koala utuh),
      // kita masukkan ke kelompok dahi agar tidak dipotong sama sekali.
      drawImg("love", topHeadX, topHeadY, 1.4, -0.6);

      // 2. KELOMPOK FULL FACE (Topeng Wajah Utuh)
      // Karena gambar yang digunakan menyambung dari telinga ke pipi, kita TIDAK BOLEH memotongnya.
      // Kita gambar secara UTUH (full) dan diletakkan di tengah wajah (pangkal hidung).
      ["bear", "cat"].forEach(name => {
        if (activeNames.includes(name)) {
          const bridgeX = getX(168);
          const bridgeY = getY(168);
          // Gambar utuh (full) ditaruh di antara mata, ukurannya dilebarkan sedikit (1.4)
          drawImg(name, bridgeX, bridgeY, 1.4, 0, "full");
        }
      });

      // 3. KELOMPOK MATA / KACAMATA
      const bridgeX = getX(168);
      const bridgeY = getY(168);
      drawImg("glasses", bridgeX, bridgeY, 1.1, 0);

      // 4. AKSESORIS PIPI
      const leftCheekX = getX(340);
      const leftCheekY = getY(340);
      const rightCheekX = getX(111);
      const rightCheekY = getY(111);

      drawImg("anime", leftCheekX, leftCheekY, 0.3, 0);
      drawImg("anime", rightCheekX, rightCheekY, 0.3, 0);
      drawImg("sparkle", rightCheekX, rightCheekY, 0.3, 0);

      drawImg("flower", getX(21), getY(21), 0.5, -0.2);
    };

    // 4. Live Render Loop
    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = liveOverlayRef.current;

      if (video && canvas && faceLandmarker) {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            try {
              const startTimeMs = performance.now();
              if (video.currentTime !== lastVideoTime.current) {
                lastVideoTime.current = video.currentTime;
                lastResults.current = faceLandmarker.detectForVideo(video, startTimeMs);
              }
            } catch (e) {
              // Ignore frame drops
            }

            if (lastResults.current && lastResults.current.faceLandmarks.length > 0) {
              drawStickers(
                ctx,
                lastResults.current.faceLandmarks[0],
                canvas.width,
                canvas.height,
                stickerImgs,
                selectedStickersRef.current
              );
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    useEffect(() => {
      requestRef.current = requestAnimationFrame(renderLoop);
      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }, [faceLandmarker, stickerImgs]);

    // 5. Fungsi Ambil Foto (Capture Gabungan)
    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth === 0) return null;

        const W = video.videoWidth;
        const H = video.videoHeight;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.filter = filterStyleMap[filter];
        ctx.drawImage(video, 0, 0, W, H);
        ctx.restore();

        if (lastResults.current && lastResults.current.faceLandmarks.length > 0) {
          drawStickers(
            ctx,
            lastResults.current.faceLandmarks[0],
            W,
            H,
            stickerImgs,
            selectedStickersRef.current
          );
        }

        return canvas.toDataURL("image/jpeg", 0.9);
      },
    }));

    // 6. Setup Kamera Feed
    useEffect(() => {
      let currentStream: MediaStream | null = null;
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            onReady(true);
          }
          currentStream = stream;
        })
        .catch((err) => {
          console.error("Camera Error:", err);
          setCameraError(err.name + ": " + err.message);
          onReady(false);
        });

      return () => {
        currentStream?.getTracks().forEach((track) => track.stop());
      };
    }, [onReady]);

    return (
      <div className="camera-container" style={{ position: "relative" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            filter: filterStyleMap[filter],
            transform: "scaleX(-1)",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 14,
            zIndex: 1,
          }}
        />

        <canvas
          ref={liveOverlayRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        <div className="camera-controls-overlay" style={{ top: 16, right: 16, transform: "none", flexDirection: "row" }}>
          <button
            onClick={() => {
              setShowFilters(!showFilters);
              setShowStickers(false);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              background: showFilters ? "var(--accent)" : "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              transition: "all 0.2s",
            }}
            title="Toggle Filter"
          >
            🎨 Filter
          </button>
          <button
            onClick={() => {
              setShowStickers(!showStickers);
              setShowFilters(false);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              background: showStickers ? "var(--accent)" : "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              transition: "all 0.2s",
            }}
            title="Toggle Sticker"
          >
            ✨ Sticker
          </button>
        </div>

        {(showFilters || showStickers) && (
          <div className="camera-bottom-drawer" style={{ display: "flex", gap: 12 }}>
            {showFilters && onFilterChange && (
              <FilterSelector
                current={filter}
                onChange={(f) => onFilterChange(f)}
              />
            )}
            {showStickers &&
              ["anime", "bear", "bunny", "cat", "crown", "flower", "frog", "glasses", "love", "sparkle"].map(
                (name) => {
                  const isActive = selectedStickers.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleSticker(name)}
                      style={{
                        flexShrink: 0,
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        cursor: "pointer",
                        border: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                        background: isActive ? "var(--accent-glow)" : "rgba(255,255,255,0.1)",
                        padding: 4,
                        transition: "all 0.2s",
                      }}
                    >
                      <img
                        src={`/stickers/${name}.png`}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        alt={name}
                      />
                    </button>
                  );
                }
              )}
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={{
          position: "absolute",
          top: 70, left: 10, right: 10,
          background: "rgba(0,0,0,0.7)",
          color: "#0f0",
          fontFamily: "monospace",
          fontSize: 10,
          padding: 8,
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 9999,
          wordWrap: "break-word"
        }}>
          {debugText}
        </div>

        {cameraError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              color: "white",
              zIndex: 2000,
              padding: 20,
              textAlign: "center"
            }}
          >
            <h3 style={{ color: "#ff4444", marginBottom: 10 }}>Kamera Error</h3>
            <p>{cameraError}</p>
            <p style={{ marginTop: 20, fontSize: 14, color: "#ccc" }}>
              Pastikan kamera tidak sedang dipakai oleh aplikasi lain (seperti Zoom/Meet) dan izinkan akses kamera di browser.
            </p>
          </div>
        )}

        {countdown !== null && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.2)",
              zIndex: 1000,
            }}
          >
            <span className="countdown-number">{countdown}</span>
          </div>
        )}

        {isCapturing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "white",
              zIndex: 1001,
            }}
            className="capture-flash"
          />
        )}
      </div>
    );
  }
);

CameraView.displayName = "CameraView";
export default CameraView;