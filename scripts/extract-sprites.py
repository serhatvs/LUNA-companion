"""
Turn a hand-made pose sheet into Luna's spritesheet.

The source sheets are drawn on a flat background with a caption under each
pose. This finds the cats by flood-filling that background away, keeps the
large components, trims each one, and packs them into a single PNG with a
uniform cell so the frontend can blit frames by index.

    python scripts/extract-sprites.py <sheet.png> [--order sit,walk-a,...]

Writes public/luna.png plus a JSON manifest of the frame order.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ORDER = [
    "sit",
    "walk-a",
    "walk-b",
    "sleep",
    "happy",
    "sad",
    "alert",
    "fall",
    "run",
    "climb",
    "groom",
]


def flood_background(rgb: np.ndarray, tolerance: int) -> np.ndarray:
    """Mark every pixel reachable from the border without crossing an edge.

    Colour-keying alone would punch holes in a black cat sitting on a dark
    background; going in from the border keeps interior darks intact.
    """
    h, w, _ = rgb.shape
    seen = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    corners = [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]]
    base = np.median(np.stack(corners), axis=0)

    def close(y: int, x: int) -> bool:
        return bool(np.abs(rgb[y, x].astype(int) - base.astype(int)).max() <= tolerance)

    for x in range(w):
        for y in (0, h - 1):
            if not seen[y, x] and close(y, x):
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y, x] and close(y, x):
                seen[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and close(ny, nx):
                seen[ny, nx] = True
                queue.append((ny, nx))

    return seen


def components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    """Connected blobs of foreground as (area, x0, y0, x1, y1)."""
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    out: list[tuple[int, int, int, int, int]] = []

    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            queue = deque([(sy, sx)])
            seen[sy, sx] = True
            area = 0
            x0 = x1 = sx
            y0 = y1 = sy
            while queue:
                y, x = queue.popleft()
                area += 1
                x0, x1 = min(x0, x), max(x1, x)
                y0, y1 = min(y0, y), max(y1, y)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
            out.append((area, x0, y0, x1, y1))
    return out


def merge_overlapping(boxes: list[tuple[int, int, int, int, int]], pad: int):
    """Whiskers and detached highlights come out as their own blobs; fold any
    box that sits inside a bigger one's neighbourhood back into it."""
    boxes = sorted(boxes, key=lambda b: -b[0])
    merged: list[list[int]] = []
    for area, x0, y0, x1, y1 in boxes:
        placed = False
        for m in merged:
            if x0 >= m[1] - pad and x1 <= m[3] + pad and y0 >= m[2] - pad and y1 <= m[4] + pad:
                m[0] += area
                m[1] = min(m[1], x0)
                m[2] = min(m[2], y0)
                m[3] = max(m[3], x1)
                m[4] = max(m[4], y1)
                placed = True
                break
        if not placed:
            merged.append([area, x0, y0, x1, y1])
    return merged


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet", type=Path)
    ap.add_argument("--order", default=",".join(DEFAULT_ORDER))
    ap.add_argument("--tolerance", type=int, default=18)
    ap.add_argument("--min-area", type=int, default=2500)
    ap.add_argument("--scale", type=float, default=1.0, help="downscale factor")
    ap.add_argument("--out", type=Path, default=ROOT / "public" / "luna.png")
    ap.add_argument("--debug-dir", type=Path, default=None)
    args = ap.parse_args()

    order = [name for name in args.order.split(",") if name]
    img = Image.open(args.sheet).convert("RGBA")
    rgb = np.array(img)[:, :, :3]

    bg = flood_background(rgb, args.tolerance)
    fg = ~bg

    blobs = [b for b in components(fg) if b[0] >= args.min_area]
    boxes = merge_overlapping(blobs, pad=14)
    boxes = [b for b in boxes if b[0] >= args.min_area]

    if len(boxes) != len(order):
        print(f"found {len(boxes)} shapes but {len(order)} names were given:", file=sys.stderr)
        for b in sorted(boxes, key=lambda b: (b[2], b[1])):
            print(f"  area={b[0]:>7} box=({b[1]},{b[2]})-({b[3]},{b[4]})", file=sys.stderr)
        return 1

    # Reading order: group into rows, then left to right within a row.
    heights = [b[4] - b[2] for b in boxes]
    row_tol = max(heights) * 0.6
    boxes.sort(key=lambda b: b[2])
    rows: list[list[list[int]]] = []
    for b in boxes:
        if rows and abs(b[2] - rows[-1][0][2]) < row_tol:
            rows[-1].append(b)
        else:
            rows.append([b])
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[1])]

    rgba = np.array(img)
    rgba[..., 3] = np.where(bg, 0, 255)
    cut = Image.fromarray(rgba, "RGBA")

    frames: list[Image.Image] = []
    for (_, x0, y0, x1, y1), name in zip(ordered, order):
        frame = cut.crop((x0, y0, x1 + 1, y1 + 1))
        if args.scale != 1.0:
            frame = frame.resize(
                (max(1, round(frame.width * args.scale)), max(1, round(frame.height * args.scale))),
                Image.LANCZOS,
            )
        frames.append(frame)
        if args.debug_dir:
            args.debug_dir.mkdir(parents=True, exist_ok=True)
            frame.save(args.debug_dir / f"{name}.png")

    cell_w = max(f.width for f in frames)
    cell_h = max(f.height for f in frames)
    sheet = Image.new("RGBA", (cell_w * len(frames), cell_h), (0, 0, 0, 0))
    boxes = []
    for i, frame in enumerate(frames):
        # Centred horizontally, sitting on the floor of the cell, so poses do
        # not jump vertically when she changes what she is doing.
        x = (cell_w - frame.width) // 2
        y = cell_h - frame.height
        sheet.paste(frame, (i * cell_w + x, y))
        # Where the cat actually is inside her cell, for hit testing.
        boxes.append([x, y, frame.width, frame.height])

    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out, optimize=True)

    manifest = {
        "cell": [cell_w, cell_h],
        "frames": order,
        "boxes": boxes,
        # Every other pose is scaled relative to how tall she sits.
        "base": order.index("sit") if "sit" in order else 0,
    }
    (args.out.parent / "luna-frames.json").write_text(json.dumps(manifest, indent=2))

    print(f"{args.out}  {sheet.width}x{sheet.height}  cell {cell_w}x{cell_h}")
    for i, (name, f) in enumerate(zip(order, frames)):
        print(f"  {i:>2} {name:<8} {f.width}x{f.height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
