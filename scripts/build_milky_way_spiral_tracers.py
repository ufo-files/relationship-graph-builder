#!/usr/bin/env python3
"""Build the checked-in Hou & Han (2014) Milky Way spiral-tracer CSV."""

from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path


SUN_GALACTOCENTRIC_RADIUS_KPC = 8.3

TABLES = (
    {
        "filename": "tablea1.dat",
        "tracer": "hii_region",
        "longitude": (5, 12),
        "latitude": (12, 19),
        "distance": (208, 214),
        "direct_distance": (102, 108),
    },
    {
        "filename": "tablea2.dat",
        "tracer": "molecular_cloud",
        "longitude": (1, 8),
        "latitude": (9, 16),
        "distance": (152, 158),
        "direct_distance": (60, 67),
    },
    {
        "filename": "tablea3.dat",
        "tracer": "methanol_maser",
        "longitude": (1, 8),
        "latitude": (8, 15),
        "distance": (123, 129),
        "direct_distance": (38, 45),
    },
)


def field(line: str, bounds: tuple[int, int]) -> float | None:
    value = line[slice(*bounds)].strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def rows(source_directory: Path):
    for table in TABLES:
        path = source_directory / table["filename"]
        for line_number, line in enumerate(path.read_text(encoding="ascii").splitlines(), 1):
            longitude = field(line, table["longitude"])
            latitude = field(line, table["latitude"])
            distance = field(line, table["distance"])
            if longitude is None or latitude is None or distance is None or distance <= 0:
                continue
            longitude_radians = math.radians(longitude)
            latitude_radians = math.radians(latitude)
            planar_distance = distance * math.cos(latitude_radians)
            yield {
                "tracer_type": table["tracer"],
                "x_kpc": planar_distance * math.sin(longitude_radians),
                "y_kpc": SUN_GALACTOCENTRIC_RADIUS_KPC - planar_distance * math.cos(longitude_radians),
                "z_kpc": distance * math.sin(latitude_radians),
                "distance_basis": "photometric_or_trigonometric" if field(line, table["direct_distance"]) is not None else "kinematic",
                "source_record": f"{table['filename']}:{line_number}",
            }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_directory", type=Path, help="Directory containing the three CDS .dat tables")
    parser.add_argument("output", type=Path, help="Destination CSV")
    args = parser.parse_args()

    output_rows = list(rows(args.source_directory))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=("tracer_type", "x_kpc", "y_kpc", "z_kpc", "distance_basis", "source_record"),
            lineterminator="\n",
        )
        writer.writeheader()
        for row in output_rows:
            writer.writerow({
                **row,
                "x_kpc": f"{row['x_kpc']:.5f}",
                "y_kpc": f"{row['y_kpc']:.5f}",
                "z_kpc": f"{row['z_kpc']:.5f}",
            })
    print(f"Wrote {len(output_rows):,} spiral tracers to {args.output}")


if __name__ == "__main__":
    main()
