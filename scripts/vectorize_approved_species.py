#!/usr/bin/env python3
"""Trace approved monochrome species rasters into lineup SVG assets."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class SpeciesAsset:
    source: Path
    vector: Path
    silhouette: Path
    display: Path | None
    title: str
    description: str
    figure_id: str
    silhouette_title: str
    silhouette_id: str


ASSETS = {
    "mothman": SpeciesAsset(
        source=ROOT / "assets/species/source/species-mothman.png",
        vector=ROOT / "assets/species/vector/species-mothman.svg",
        silhouette=ROOT / "assets/species/silhouette/species-mothman.svg",
        display=ROOT / "assets/species/vector/display/species-mothman.svg",
        title="Dark Point Pleasant Mothman lineup drawing",
        description=(
            "A tall charcoal humanoid with a small round head, two prominent red "
            "eyes, and broad articulated wings folded behind the body."
        ),
        figure_id="mothman-figure",
        silhouette_title="Tall folded-wing Mothman silhouette",
        silhouette_id="mothman-silhouette",
    ),
    "mantis-beings": SpeciesAsset(
        source=ROOT / "assets/species/source/species-mantis-beings.png",
        vector=ROOT / "assets/species/vector/species-mantis-beings.svg",
        silhouette=ROOT / "assets/species/silhouette/species-mantis-beings.svg",
        display=ROOT / "assets/species/vector/display/species-mantis-beings.svg",
        title="Tall mantis being lineup drawing",
        description=(
            "A tall bony insectoid with a broad rounded triangular head, dominant "
            "lateral eyes, a long neck, elbow-bent arms, long jointed legs, and "
            "three-pronged extremities."
        ),
        figure_id="mantis-figure",
        silhouette_title="Tall mantis-being silhouette",
        silhouette_id="mantis-silhouette",
    ),
    "light-beings": SpeciesAsset(
        source=ROOT / "assets/species/source/species-light-beings.png",
        vector=ROOT / "assets/species/vector/species-light-beings.svg",
        silhouette=ROOT / "assets/species/silhouette/species-light-beings.svg",
        display=None,
        title="Full-body luminous light being",
        description=(
            "A calm bipedal figure rendered with bold sparse contours, a continuous "
            "whole-body emission outline, and evenly distributed light rays."
        ),
        figure_id="full-body-luminosity",
        silhouette_title="Full-body luminous light-being silhouette",
        silhouette_id="light-being-silhouette",
    ),
    "bledsoe-red-eyed-being": SpeciesAsset(
        source=ROOT / "assets/species/source/species-bledsoe-red-eyed-being.png",
        vector=ROOT / "assets/species/vector/species-bledsoe-red-eyed-being-v3.svg",
        silhouette=ROOT / "assets/species/silhouette/species-bledsoe-red-eyed-being-v3.svg",
        display=None,
        title="Cape Fear red-eyed being lineup drawing",
        description=(
            "A small glassy-looking humanoid with little visible neck, circular red "
            "goggle-like eyes, a lower-face covering, and a dark chest plate, based "
            "on the witness description published in the 2008 MUFON Journal."
        ),
        figure_id="bledsoe-red-eyed-figure",
        silhouette_title="Cape Fear red-eyed being silhouette",
        silhouette_id="bledsoe-red-eyed-silhouette",
    ),
    "skinny-bob": SpeciesAsset(
        source=ROOT / "assets/species/source/species-skinny-bob.png",
        vector=ROOT / "assets/species/vector/species-skinny-bob-v5.svg",
        silhouette=ROOT / "assets/species/silhouette/species-skinny-bob-v5.svg",
        display=None,
        title="Skinny Bob reference lineup drawing",
        description=(
            "An original reference interpretation of the slender, large-headed, "
            "dark-eyed humanoid shown in anonymously uploaded 2011 footage whose "
            "authenticity remains unresolved."
        ),
        figure_id="skinny-bob-figure",
        silhouette_title="Skinny Bob reference silhouette",
        silhouette_id="skinny-bob-silhouette",
    ),
}

MEN_IN_BLACK_SOURCES = {
    ROOT / "assets/species/source/species-men-in-black.svg":
        ROOT / "assets/species/vector/species-men-in-black.svg",
    ROOT / "assets/species/source/species-men-in-black-display.svg":
        ROOT / "assets/species/vector/display/species-men-in-black.svg",
}

MEN_IN_BLACK_SUIT_SEEDS = (
    (510, 95),    # hat crown
    (320, 560),   # left sleeve
    (430, 560),   # left jacket panel
    (595, 560),   # right jacket panel
    (705, 560),   # right sleeve
    (445, 385),   # left lapel
    (575, 385),   # right lapel
    (510, 430),   # tie
    (430, 1050),  # left trouser leg
    (595, 1050),  # right trouser leg
    (355, 1450),  # left shoe
    (665, 1450),  # right shoe
)


def run(*args: str | Path) -> None:
    subprocess.run([str(arg) for arg in args], check=True)


def annotate(svg_path: Path, title: str, description: str, group_id: str) -> None:
    svg = svg_path.read_text(encoding="utf-8")
    svg = svg.replace(
        'preserveAspectRatio="xMidYMid meet">',
        'preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="title desc">\n'
        f'<title id="title">{title}</title>\n'
        f'<desc id="desc">{description}</desc>',
        1,
    )
    svg = svg.replace("<g transform=", f'<g id="{group_id}" transform=', 1)
    svg_path.write_text(svg, encoding="utf-8")


def traced_group(svg_path: Path, fill: str, group_id: str) -> str:
    svg = svg_path.read_text(encoding="utf-8")
    start = svg.index("<g ")
    end = svg.rindex("</g>") + len("</g>")
    group = svg[start:end]
    group = group.replace("<g ", f'<g id="{group_id}" ', 1)
    group = group.replace('fill="#000000"', f'fill="{fill}"', 1)
    return group


def trace_mothman(asset: SpeciesAsset) -> None:
    """Trace the approved flat-color raster as independently tunable layers."""
    if not asset.source.exists():
        raise FileNotFoundError(asset.source)

    with tempfile.TemporaryDirectory(prefix="species-vector-") as tmp_name:
        tmp = Path(tmp_name)
        figure_bitmap = tmp / "figure.pbm"
        base_ink_bitmap = tmp / "base-ink.pbm"
        expanded_ink_bitmap = tmp / "expanded-ink.pbm"
        ink_bitmap = tmp / "ink.pbm"
        eyes_bitmap = tmp / "eyes.pbm"
        figure_svg = tmp / "figure.svg"
        ink_svg = tmp / "ink.svg"
        eyes_svg = tmp / "eyes.svg"

        # The approved raster is deliberately flat. Trace its charcoal mass,
        # black drawing, and red spot color separately so the final SVG retains
        # the selected design without embedding raster data. The one-pixel ink
        # expansion compensates for dark-on-dark apparent thinning after the
        # 1536 px source is reduced to the roughly 200 px lineup figure.
        run(
            "magick", asset.source,
            "-colorspace", "Gray", "-threshold", "80%",
            figure_bitmap,
        )
        run(
            "magick", asset.source,
            "-colorspace", "sRGB",
            "-fx", "(r < 0.25 && g < 0.25 && b < 0.25) ? 0 : 1",
            base_ink_bitmap,
        )
        run(
            "magick", base_ink_bitmap,
            "-negate", "-morphology", "Dilate", "Disk:1", "-negate",
            expanded_ink_bitmap,
        )
        run(
            "magick", expanded_ink_bitmap, base_ink_bitmap,
            "-fx", "j < 1260 ? u[0] : u[1]",
            ink_bitmap,
        )
        run(
            "magick", asset.source,
            "-colorspace", "sRGB",
            "-fx", "(r > 0.45 && r > g * 1.6 && r > b * 1.6 && g < 0.4) ? 0 : 1",
            eyes_bitmap,
        )

        for bitmap, output, turdsize, tolerance in (
            (figure_bitmap, figure_svg, "20", "0.4"),
            (ink_bitmap, ink_svg, "4", "0.3"),
            (eyes_bitmap, eyes_svg, "4", "0.3"),
        ):
            run(
                "potrace", "-s", "--flat", "-t", turdsize, "-O", tolerance,
                "-o", output, bitmap,
            )

        vector = (
            '<?xml version="1.0" standalone="no"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" '
            'width="1024.000000pt" height="1536.000000pt" '
            'viewBox="0 0 1024.000000 1536.000000" '
            'preserveAspectRatio="xMidYMid meet" role="img" '
            'aria-labelledby="title desc">\n'
            f'<title id="title">{asset.title}</title>\n'
            f'<desc id="desc">{asset.description}</desc>\n'
            '<metadata>Created by potrace 1.16; layered from the approved raster.</metadata>\n'
            f'{traced_group(figure_svg, "#666666", "mothman-charcoal")}\n'
            f'{traced_group(ink_svg, "#000000", "mothman-ink")}\n'
            f'{traced_group(eyes_svg, "#c3262d", "mothman-red-eyes")}\n'
            '</svg>\n'
        )
        asset.vector.write_text(vector, encoding="utf-8")

        shutil.copyfile(figure_svg, asset.silhouette)
        annotate(
            asset.silhouette,
            asset.silhouette_title,
            asset.description,
            asset.silhouette_id,
        )

    if asset.display:
        shutil.copyfile(asset.vector, asset.display)


def trace_red_eyed_being(asset: SpeciesAsset) -> None:
    """Trace monochrome ink and retain the report's distinctive red eye color."""
    if not asset.source.exists():
        raise FileNotFoundError(asset.source)

    with tempfile.TemporaryDirectory(prefix="species-vector-") as tmp_name:
        tmp = Path(tmp_name)
        ink_bitmap = tmp / "ink.pbm"
        eyes_bitmap = tmp / "eyes.pbm"
        silhouette_bitmap = tmp / "silhouette.pbm"
        ink_svg = tmp / "ink.svg"
        eyes_svg = tmp / "eyes.svg"

        run(
            "magick", asset.source, "-colorspace", "Gray", "-threshold", "82%",
            "-negate", "-morphology", "Dilate", "Disk:2", "-negate", ink_bitmap,
        )
        run(
            "magick", asset.source, "-colorspace", "sRGB", "-fx",
            "(r > 0.42 && r > g * 1.45 && r > b * 1.45 && g < 0.5) ? 0 : 1",
            eyes_bitmap,
        )
        for bitmap, output in ((ink_bitmap, ink_svg), (eyes_bitmap, eyes_svg)):
            run("potrace", "-s", "--flat", "-t", "4", "-O", "0.3", "-o", output, bitmap)

        vector = (
            '<?xml version="1.0" standalone="no"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="1024.000000pt" '
            'height="1536.000000pt" viewBox="0 0 1024.000000 1536.000000" '
            'preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="title desc">\n'
            f'<title id="title">{asset.title}</title>\n'
            f'<desc id="desc">{asset.description}</desc>\n'
            '<metadata>Created by potrace 1.16; layered from the approved raster.</metadata>\n'
            f'{traced_group(ink_svg, "#000000", "bledsoe-red-eyed-ink")}\n'
            f'{traced_group(eyes_svg, "#c3262d", "bledsoe-red-eyes")}\n'
            '</svg>\n'
        )
        asset.vector.write_text(vector, encoding="utf-8")

        run(
            "magick", ink_bitmap, "-negate", "-morphology", "Close", "Disk:2", "-negate",
            "-bordercolor", "white", "-border", "1", "-fill", "black", "-draw",
            "color 0,0 floodfill", "-shave", "1x1", silhouette_bitmap,
        )
        run("potrace", "-s", "--flat", "-t", "20", "-O", "0.4", "-o", asset.silhouette, silhouette_bitmap)
        annotate(asset.silhouette, asset.silhouette_title, asset.description, asset.silhouette_id)


def trace_men_in_black() -> None:
    """Add a flat near-black clothing layer behind the approved vector ink."""
    for source, output in MEN_IN_BLACK_SOURCES.items():
        if not source.exists():
            raise FileNotFoundError(source)

        with tempfile.TemporaryDirectory(prefix="species-vector-") as tmp_name:
            tmp = Path(tmp_name)
            line_bitmap = tmp / "line.png"
            suit_bitmap = tmp / "suit.pbm"
            hat_bitmap = tmp / "hat.pbm"
            combined_bitmap = tmp / "combined.pbm"
            suit_svg = tmp / "suit.svg"

            run(
                "magick", "-background", "white", source, "-alpha", "remove",
                "-resize", "1024x1536!", "-threshold", "90%", line_bitmap,
            )
            suit_draw = " ".join(
                f"color {x},{y} floodfill" for x, y in MEN_IN_BLACK_SUIT_SEEDS
            )
            run(
                "magick", line_bitmap, "-fill", "black", "-draw", suit_draw,
                suit_bitmap,
            )

            # The lower hat region is open to the face in the source drawing.
            # Trace it independently and clip below the brim so pallid skin
            # remains unfilled while the complete hat still reads as black.
            run(
                "magick", line_bitmap, "-fill", "black", "-draw",
                "color 510,153 floodfill", "-fill", "white", "-draw",
                "rectangle 0,180 1024,1536", hat_bitmap,
            )
            run(
                "magick", suit_bitmap, hat_bitmap,
                "-evaluate-sequence", "min", combined_bitmap,
            )
            run(
                "potrace", "-s", "--flat", "-t", "4", "-O", "0.3",
                "-o", suit_svg, combined_bitmap,
            )

            vector = (
                '<?xml version="1.0" standalone="no"?>\n'
                '<svg xmlns="http://www.w3.org/2000/svg" '
                'width="1024.000000pt" height="1536.000000pt" '
                'viewBox="0 0 1024.000000 1536.000000" '
                'preserveAspectRatio="xMidYMid meet" role="img" '
                'aria-labelledby="title desc">\n'
                '<title id="title">Men in Black lineup drawing</title>\n'
                '<desc id="desc">A tall pallid man wearing sunglasses, a formal '
                'near-black suit, black tie, black hat, and black shoes.</desc>\n'
                '<metadata>Approved vector line art with a traced flat-color suit layer.</metadata>\n'
                f'{traced_group(suit_svg, "#242424", "men-in-black-suit")}\n'
                f'{traced_group(source, "#000000", "men-in-black-ink")}\n'
                '</svg>\n'
            )
            output.write_text(vector, encoding="utf-8")


def trace(asset: SpeciesAsset) -> None:
    if asset.figure_id == "mothman-figure":
        trace_mothman(asset)
        return
    if asset.figure_id == "bledsoe-red-eyed-figure":
        trace_red_eyed_being(asset)
        return
    if not asset.source.exists():
        raise FileNotFoundError(asset.source)

    with tempfile.TemporaryDirectory(prefix="species-vector-") as tmp_name:
        tmp = Path(tmp_name)
        line_bitmap = tmp / "line.pbm"
        silhouette_bitmap = tmp / "silhouette.pbm"

        run(
            "magick",
            asset.source,
            "-colorspace",
            "Gray",
            "-threshold",
            "70%",
            "-negate",
            "-morphology",
            "Dilate",
            "Disk:3" if asset.figure_id == "skinny-bob-figure" else "Disk:1",
            "-negate",
            line_bitmap,
        )
        run(
            "potrace",
            "-s",
            "--flat",
            "-t",
            "4",
            "-O",
            "0.3",
            "-o",
            asset.vector,
            line_bitmap,
        )
        annotate(asset.vector, asset.title, asset.description, asset.figure_id)

        # Close small antialiasing gaps, remove the exterior field, and turn all
        # regions enclosed by the approved ink into one monochrome silhouette.
        run(
            "magick",
            line_bitmap,
            "-negate",
            "-morphology",
            "Close",
            "Disk:2",
            "-negate",
            "-bordercolor",
            "white",
            "-border",
            "1",
            "-alpha",
            "on",
            "-fill",
            "none",
            "-draw",
            "color 0,0 floodfill",
            "-shave",
            "1x1",
            "-channel",
            "A",
            "-threshold",
            "0",
            "+channel",
            "-fill",
            "black",
            "-colorize",
            "100",
            "-background",
            "white",
            "-alpha",
            "background",
            "-alpha",
            "off",
            silhouette_bitmap,
        )
        run(
            "potrace",
            "-s",
            "--flat",
            "-t",
            "20",
            "-O",
            "0.4",
            "-o",
            asset.silhouette,
            silhouette_bitmap,
        )
        annotate(
            asset.silhouette,
            asset.silhouette_title,
            asset.description,
            asset.silhouette_id,
        )

    if asset.display:
        shutil.copyfile(asset.vector, asset.display)


def main() -> None:
    parser = argparse.ArgumentParser()
    choices = sorted((*ASSETS, "men-in-black"))
    parser.add_argument("species", nargs="*", choices=choices)
    args = parser.parse_args()
    selected = args.species or choices
    for species in selected:
        if species == "men-in-black":
            trace_men_in_black()
        else:
            trace(ASSETS[species])


if __name__ == "__main__":
    main()
