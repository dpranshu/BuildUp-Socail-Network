"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw, X, ZoomIn } from "lucide-react";

const canvasSize = 320;
const previewPixels = 640;
const previewSize = 360;
const maxCompressedBytes = 1.75 * 1024 * 1024;

type ImageOffset = { x: number; y: number };

export type PostImageSelection = {
  source: File;
  rotation: number;
  zoom: number;
  offset: ImageOffset;
  preview: File;
};

export async function compressPostImage(selection: PostImageSelection): Promise<File> {
  let source: Blob = selection.source;
  if (/\.hei[cf]$/i.test(selection.source.name) || /image\/hei[cf]/i.test(selection.source.type)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: selection.source, toType: "image/jpeg", quality: 0.9 });
    source = Array.isArray(converted) ? converted[0] : converted;
    if (!source) throw new Error("No image was returned by the HEIC converter.");
  }

  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    const encodings = [
      [1440, 0.84],
      [1440, 0.74],
      [1440, 0.64],
      [1200, 0.72],
      [960, 0.68],
    ] as const;

    for (const [size, quality] of encodings) {
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editing is not supported by this browser.");
      context.setTransform(size / canvasSize, 0, 0, size / canvasSize, 0, 0);
      drawCroppedImage(context, bitmap, canvasSize, selection.rotation, selection.zoom, selection.offset);
      const candidate = await canvasToBlob(canvas, quality);
      if (candidate.size <= maxCompressedBytes) {
        return new File([candidate], "post-image.jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
    throw new Error("This image could not be compressed enough. Try a tighter crop or a smaller image.");
  } finally {
    bitmap.close();
  }
}

export function PostImageEditor({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  onSave: (selection: PostImageSelection) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState("");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<ImageOffset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    let loadedBitmap: ImageBitmap | null = null;

    async function loadImage() {
      try {
        let source: Blob = file;
        if (/\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
          const { default: heic2any } = await import("heic2any");
          const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
          source = Array.isArray(converted) ? converted[0] : converted;
          if (!source) throw new Error("No image was returned by the HEIC converter.");
        }

        loadedBitmap = await createImageBitmap(source);
        if (!active) {
          loadedBitmap.close();
          return;
        }
        setBitmap(loadedBitmap);
        setLoadedFile(file);
        setLoadError("");
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error
            ? "This image could not be opened. Try saving it as JPEG, PNG, or WebP and choose it again."
            : "This image could not be opened.");
        }
      }
    }

    void loadImage();
    return () => {
      active = false;
      loadedBitmap?.close();
    };
  }, [file]);

  useEffect(() => {
    if (!bitmap || loadedFile !== file) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    canvas.width = previewPixels;
    canvas.height = previewPixels;
    context.setTransform(previewPixels / canvasSize, 0, 0, previewPixels / canvasSize, 0, 0);
    drawCroppedImage(context, bitmap, canvasSize, rotation, zoom, offset);
  }, [bitmap, file, loadedFile, offset, rotation, zoom]);

  function changeOffset(next: ImageOffset) {
    if (!bitmap) return;
    setOffset(clampOffset(next, bitmap, rotation, zoom));
  }

  function rotateImage() {
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    if (bitmap) setOffset((current) => clampOffset(current, bitmap, nextRotation, zoom));
  }

  async function applyCrop() {
    if (!bitmap || loadedFile !== file) return;
    setSaving(true);
    setSaveError("");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = previewSize;
      canvas.height = previewSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editing is not supported by this browser.");
      context.setTransform(previewSize / canvasSize, 0, 0, previewSize / canvasSize, 0, 0);
      drawCroppedImage(context, bitmap, canvasSize, rotation, zoom, offset);
      const preview = await canvasToBlob(canvas, 0.76);
      onSave({
        source: file,
        rotation,
        zoom,
        offset,
        preview: new File([preview], "post-preview.jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        }),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to apply this crop.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  const imageReady = Boolean(bitmap && loadedFile === file);
  const imageLoading = !imageReady && !loadError;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-5">
      <section
        aria-labelledby="image-editor-title"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-t-2xl border hairline bg-[var(--background)] p-5 shadow-2xl sm:rounded-2xl"
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="image-editor-title" className="text-base font-semibold text-white">Edit image</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Drag to crop, zoom, then rotate if needed.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close image editor"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
          >
            <X size={19} />
          </button>
        </div>

        {imageReady ? (
          <canvas
            ref={canvasRef}
            aria-label="Square image crop preview. Drag to reposition."
            className="mx-auto block aspect-square w-full max-w-[320px] touch-none cursor-grab rounded-lg bg-black active:cursor-grabbing"
            onPointerDown={(event) => {
              dragRef.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!dragRef.current) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const scale = canvasSize / rect.width;
              const deltaX = (event.clientX - dragRef.current.x) * scale;
              const deltaY = (event.clientY - dragRef.current.y) * scale;
              dragRef.current = { x: event.clientX, y: event.clientY };
              changeOffset({ x: offset.x + deltaX, y: offset.y + deltaY });
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
          />
        ) : (
          <div className="mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center rounded-lg bg-white/[0.04] px-6 text-center text-sm text-[var(--muted)]">
            {imageLoading ? "Preparing your image…" : loadError}
          </div>
        )}

        {imageReady && (
          <div className="mx-auto mt-4 flex max-w-[320px] items-center gap-3">
            <ZoomIn size={17} className="shrink-0 text-[var(--muted)]" />
            <label className="sr-only" htmlFor="post-image-zoom">Zoom crop</label>
            <input
              id="post-image-zoom"
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.currentTarget.value);
                setZoom(nextZoom);
                if (bitmap) setOffset((current) => clampOffset(current, bitmap, rotation, nextZoom));
              }}
              className="min-w-0 flex-1 accent-[var(--blue)]"
            />
            <button
              type="button"
              onClick={rotateImage}
              aria-label="Rotate image 90 degrees"
              title="Rotate 90°"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border hairline text-white hover:bg-white/[0.08]"
            >
              <RotateCw size={18} />
            </button>
          </div>
        )}

        {saveError && <p role="alert" className="mt-3 text-sm text-rose-300">{saveError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="min-h-10 rounded-md px-4 text-sm text-[var(--muted)] hover:bg-white/[0.06] disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void applyCrop()}
            disabled={!imageReady || saving}
            className="min-h-10 rounded-md bg-[var(--blue)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Applying…" : "Apply crop"}
          </button>
        </div>
      </section>
    </div>
  );
}

function clampOffset(offset: ImageOffset, bitmap: ImageBitmap, rotation: number, zoom: number): ImageOffset {
  const quarterTurn = rotation % 180 !== 0;
  const imageWidth = quarterTurn ? bitmap.height : bitmap.width;
  const imageHeight = quarterTurn ? bitmap.width : bitmap.height;
  const scale = Math.max(canvasSize / imageWidth, canvasSize / imageHeight) * zoom;
  const maxX = Math.max(0, (imageWidth * scale - canvasSize) / 2);
  const maxY = Math.max(0, (imageHeight * scale - canvasSize) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}

function drawCroppedImage(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  size: number,
  rotation: number,
  zoom: number,
  offset: ImageOffset,
) {
  const quarterTurn = rotation % 180 !== 0;
  const rotatedWidth = quarterTurn ? bitmap.height : bitmap.width;
  const rotatedHeight = quarterTurn ? bitmap.width : bitmap.height;
  const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * zoom;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.save();
  context.translate(size / 2 + offset.x, size / 2 + offset.y);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, -(bitmap.width * scale) / 2, -(bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  context.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("This image could not be compressed by the browser."));
    }, "image/jpeg", quality);
  });
}
