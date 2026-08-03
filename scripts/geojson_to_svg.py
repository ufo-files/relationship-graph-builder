#!/usr/bin/env python3
"""Convert GeoJSON country polygons to an equirectangular SVG texture."""

from __future__ import annotations

import argparse
import json
from html import escape
from pathlib import Path


WIDTH = 2000
HEIGHT = 1000


def project(coordinate: list[float]) -> tuple[float, float]:
    longitude, latitude = coordinate[:2]
    return (longitude + 180) / 360 * WIDTH, (90 - latitude) / 180 * HEIGHT


def ring_path(ring: list[list[float]]) -> str:
    parts: list[str] = []
    previous_longitude: float | None = None
    for coordinate in ring:
        longitude = coordinate[0]
        x, y = project(coordinate)
        command = "M" if previous_longitude is None or abs(longitude - previous_longitude) > 180 else "L"
        parts.append(f"{command}{x:.2f},{y:.2f}")
        previous_longitude = longitude
    return " ".join(parts) + " Z"


def geometry_paths(geometry: dict) -> list[str]:
    coordinates = geometry.get("coordinates", [])
    polygons = [coordinates] if geometry.get("type") == "Polygon" else coordinates
    return [" ".join(ring_path(ring) for ring in polygon) for polygon in polygons]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    features = json.loads(args.input.read_text(encoding="utf-8"))["features"]
    paths = []
    for feature in features:
        name = feature.get("properties", {}).get("ADMIN", "Country")
        for path in geometry_paths(feature["geometry"]):
            paths.append(f'<path aria-label="{escape(name, quote=True)}" d="{path}"/>')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}">'
        '<metadata>Country boundaries derived from Natural Earth 1:110m public-domain data.</metadata>'
        '<rect width="2000" height="1000" fill="#f6f5ef"/>'
        '<g fill="#e2e1da" stroke="#111" stroke-width="2.2" vector-effect="non-scaling-stroke">'
        + "".join(paths)
        + "</g></svg>\n"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
