export type LocalVideoMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
};

type Mp4Box = { type: string; start: number; contentStart: number; end: number };

/**
 * Lee metadatos ISO-BMFF/MP4 directamente desde memoria. No decodifica frames,
 * no usa red y permite revisar archivos cuyo codec no reproduce el navegador.
 */
export function parseMp4Metadata(buffer: ArrayBuffer): LocalVideoMetadata {
  const view = new DataView(buffer);
  const topLevel = readBoxes(view, 0, view.byteLength);
  const moov = topLevel.find((box) => box.type === "moov");
  if (!moov) throw new Error("MP4_SIN_MOOV");

  const moovChildren = readBoxes(view, moov.contentStart, moov.end);
  const durationSeconds = readMovieDuration(view, moovChildren.find((box) => box.type === "mvhd"));
  const videoTrack = moovChildren
    .filter((box) => box.type === "trak")
    .map((track) => readVideoTrack(view, track))
    .find((track): track is { width: number; height: number } => track !== null);

  if (!videoTrack || videoTrack.width <= 0 || videoTrack.height <= 0) {
    throw new Error("MP4_SIN_PISTA_VIDEO");
  }
  return {
    width: Math.round(videoTrack.width),
    height: Math.round(videoTrack.height),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  };
}

function readMovieDuration(view: DataView, mvhd?: Mp4Box): number {
  if (!mvhd) return 0;
  const start = mvhd.contentStart;
  const version = view.getUint8(start);
  const timescaleOffset = version === 1 ? start + 20 : start + 12;
  const durationOffset = version === 1 ? start + 24 : start + 16;
  ensureRange(view, timescaleOffset, version === 1 ? 12 : 8, mvhd.end);
  const timescale = view.getUint32(timescaleOffset);
  const duration = version === 1 ? readUint64(view, durationOffset) : view.getUint32(durationOffset);
  return timescale > 0 ? duration / timescale : 0;
}

function readVideoTrack(view: DataView, track: Mp4Box): { width: number; height: number } | null {
  const children = readBoxes(view, track.contentStart, track.end);
  const tkhd = children.find((box) => box.type === "tkhd");
  const mdia = children.find((box) => box.type === "mdia");
  if (!tkhd || !mdia) return null;

  const handler = readBoxes(view, mdia.contentStart, mdia.end).find((box) => box.type === "hdlr");
  if (!handler) return null;
  ensureRange(view, handler.contentStart, 12, handler.end);
  if (readFourCc(view, handler.contentStart + 8) !== "vide") return null;

  const version = view.getUint8(tkhd.contentStart);
  const widthOffset = tkhd.contentStart + (version === 1 ? 88 : 76);
  ensureRange(view, widthOffset, 8, tkhd.end);
  return {
    width: view.getUint32(widthOffset) / 65_536,
    height: view.getUint32(widthOffset + 4) / 65_536,
  };
}

function readBoxes(view: DataView, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size32 = view.getUint32(offset);
    const type = readFourCc(view, offset + 4);
    let headerSize = 8;
    let size = size32;
    if (size32 === 1) {
      ensureRange(view, offset, 16, end);
      size = readUint64(view, offset + 8);
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - offset;
    }
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > end) break;
    boxes.push({ type, start: offset, contentStart: offset + headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function readUint64(view: DataView, offset: number): number {
  return view.getUint32(offset) * 4_294_967_296 + view.getUint32(offset + 4);
}

function readFourCc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function ensureRange(view: DataView, start: number, length: number, end: number) {
  if (start < 0 || length < 0 || start + length > end || start + length > view.byteLength) {
    throw new Error("MP4_TRUNCADO");
  }
}
