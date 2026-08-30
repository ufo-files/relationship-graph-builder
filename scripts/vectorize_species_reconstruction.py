#!/usr/bin/env python3
"""Normalize a generated species reconstruction and trace monochrome SVG artwork."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import potrace


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/species/source/species-reptilians.png"
VECTOR = ROOT / "assets/species/vector/species-reptilians.svg"
SILHOUETTE = ROOT / "assets/species/silhouette/species-reptilians.svg"
CANVAS = (1024, 1536)


def normalized_source() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("source artwork is fully transparent")
    source = source.crop(bounds)
    target = (900, 1450)
    source.thumbnail(target, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    canvas.alpha_composite(source, ((CANVAS[0] - source.width) // 2, CANVAS[1] - source.height - 35))
    return canvas


def trace(mask: np.ndarray, turdsize: int, tolerance: float) -> str:
    scale_x = CANVAS[0] / mask.shape[1]
    scale_y = CANVAS[1] / mask.shape[0]

    def point(value) -> str:
        return f"{value.x * scale_x:.2f} {value.y * scale_y:.2f}"

    curves = potrace.Bitmap(~mask).trace(
        turdsize=turdsize,
        alphamax=1.0,
        opticurve=True,
        opttolerance=tolerance,
    )
    commands = []
    for curve in curves:
        commands.append(f"M{point(curve.start_point)}")
        for segment in curve:
            if segment.is_corner:
                commands.append(
                    f"L{point(segment.c)} L{point(segment.end_point)}"
                )
            else:
                commands.append(
                    f"C{point(segment.c1)} {point(segment.c2)} {point(segment.end_point)}"
                )
        commands.append("Z")
    return " ".join(commands)


def write_svg(path: Path, path_data: str) -> None:
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024.000000 1536.000000" '
        'width="1024" height="1536" role="img">'
        f'<path d="{path_data}" fill="#000" fill-rule="evenodd"/>'
        '</svg>\n',
        encoding="utf-8",
    )


def filled_silhouette(line_mask: np.ndarray) -> np.ndarray:
    """Fill the organism inside its outer line-art contour."""
    closed_lines = Image.fromarray(line_mask).filter(ImageFilter.MaxFilter(7))
    regions = Image.fromarray(
        np.where(np.asarray(closed_lines), 0, 255).astype(np.uint8)
    ).copy()
    ImageDraw.floodfill(regions, (0, 0), 0)
    return (np.asarray(regions) > 0) | np.asarray(closed_lines)


def main() -> None:
    source = normalized_source()
    alpha = np.asarray(source.getchannel("A")) > 40
    white = Image.new("RGBA", CANVAS, "white")
    white.alpha_composite(source)
    gray = ImageOps.autocontrast(white.convert("L"), cutoff=(1, 1))

    # The approved reconstruction is monochrome line art. Trace its ink
    # directly so the face, joints, and restrained scale fields survive at
    # full size, then flood-fill the outer contour for the background mask.
    line_mask = alpha & (np.asarray(gray) < 210)
    silhouette_mask = filled_silhouette(line_mask)

    line_image = Image.fromarray(line_mask).resize((512, 768), Image.Resampling.NEAREST)
    silhouette_image = Image.fromarray(silhouette_mask).resize((256, 384), Image.Resampling.NEAREST)
    write_svg(VECTOR, trace(np.asarray(line_image), turdsize=2, tolerance=0.2))
    write_svg(SILHOUETTE, trace(np.asarray(silhouette_image), turdsize=8, tolerance=0.4))


if __name__ == "__main__":
    main()
