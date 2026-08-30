#!/usr/bin/env python3
"""Build the checked-in Reid et al. (2019) VLBI maser-position CSV."""

from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path


SUN_GALACTOCENTRIC_RADIUS_KPC = 8.3


def field(line: str, start: int, end: int) -> float:
    return float(line[start:end].strip())


def rows(table: Path):
    for line_number, line in enumerate(table.read_text(encoding="ascii").splitlines(), 1):
        try:
            right_ascension = 15 * (field(line, 31, 33) + field(line, 34, 36) / 60 + field(line, 37, 44) / 3600)
            declination = field(line, 47, 49) + field(line, 50, 52) / 60 + field(line, 53, 59) / 3600
            if line[46] == "-":
                declination *= -1
            parallax = field(line, 62, 67)
            parallax_error = field(line, 68, 73)
        except (ValueError, IndexError):
            continue
        if parallax <= 0:
            continue

        ra = math.radians(right_ascension)
        dec = math.radians(declination)
        equatorial_x = math.cos(dec) * math.cos(ra)
        equatorial_y = math.cos(dec) * math.sin(ra)
        equatorial_z = math.sin(dec)
        galactic_x = -0.0548755604 * equatorial_x - 0.8734370902 * equatorial_y - 0.4838350155 * equatorial_z
        galactic_y = 0.4941094279 * equatorial_x - 0.4448296300 * equatorial_y + 0.7469822445 * equatorial_z
        galactic_z = -0.8676661490 * equatorial_x - 0.1980763734 * equatorial_y + 0.4559837762 * equatorial_z
        distance_kpc = 1 / parallax
        yield {
            "name": line[0:13].strip(),
            "x_kpc": distance_kpc * galactic_y,
            "y_kpc": SUN_GALACTOCENTRIC_RADIUS_KPC - distance_kpc * galactic_x,
            "z_kpc": distance_kpc * galactic_z,
            "parallax_mas": parallax,
            "parallax_error_mas": parallax_error,
            "arm": line[113:116].strip(),
            "source_record": f"table1.dat:{line_number}",
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("table", type=Path, help="Reid et al. CDS table1.dat")
    parser.add_argument("output", type=Path, help="Destination CSV")
    args = parser.parse_args()

    output_rows = list(rows(args.table))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=("name", "x_kpc", "y_kpc", "z_kpc", "parallax_mas", "parallax_error_mas", "arm", "source_record"),
            lineterminator="\n",
        )
        writer.writeheader()
        for row in output_rows:
            writer.writerow({
                **row,
                "x_kpc": f"{row['x_kpc']:.5f}",
                "y_kpc": f"{row['y_kpc']:.5f}",
                "z_kpc": f"{row['z_kpc']:.5f}",
                "parallax_mas": f"{row['parallax_mas']:.3f}",
                "parallax_error_mas": f"{row['parallax_error_mas']:.3f}",
            })
    print(f"Wrote {len(output_rows):,} VLBI masers to {args.output}")


if __name__ == "__main__":
    main()
