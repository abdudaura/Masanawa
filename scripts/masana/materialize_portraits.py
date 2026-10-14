#!/usr/bin/env python3
"""Convert the uploaded photographic atlas into named, independently usable WebP assets.

The raw atlas contains only portrait pixels; text labels from generated sheets
are excluded from this material. Do not match people using generated captions.
"""
import base64
import io
import json
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "apps/mobile/assets/masana/portraits"
KEYS = [
    ("gwani", "Gwani"),
    ("gwana", "Gwana"),
    ("amina", "Dr. Amina Yusuf"),
    ("fatima", "Nurse Fatima Abdullahi"),
    ("salim", "Pharm. Salim Ibrahim"),
    ("zainab", "Barr. Zainab Bello"),
    ("sadiq", "Prof. Sadiq Musa"),
    ("musa", "Engr. Musa Garba"),
    ("bello", "Engr. Bello Shehu"),
    ("umar", "Engr. Umar Lawal"),
    ("safiya", "Arc. Safiya Kabir"),
    ("ruqayya", "Prof. Ruqayya Haruna"),
    ("idris", "Dr. Idris Muhammad"),
    ("maryam", "Prof. Maryam Usman"),
    ("kabir", "Dr. Kabir Ahmad"),
    ("hauwa", "Prof. Hauwa Sani"),
    ("yusuf", "Dr. Yusuf Danladi"),
    ("haruna", "Prof. Haruna Adamu"),
    ("bilkisu", "Dr. Bilkisu Suleiman"),
    ("nura", "Dr. Nura Abdullahi"),
    ("aisha", "Dr. Aisha Tanko"),
    ("abdulrahman", "Prof. Abdulrahman Isah"),
    ("layla", "Ustazah Layla Hassan"),
    ("grace", "Prof. Grace Okonkwo"),
    ("asha", "Madam Asha Verma"),
    ("mei", "Prof. Mei Lin"),
]
N_PARTS = 6
SIZE = 128

def main() -> None:
    parts = [ROOT / f"source-atlas.part{i:02d}.txt" for i in range(N_PARTS)]
    if not all(p.is_file() for p in parts):
        print(f"Photographic atlas incomplete; {sum(p.is_file() for p in parts)}/{N_PARTS} parts")
        return
    binary = base64.b64decode("".join(p.read_text().strip() for p in parts), validate=True)
    atlas = Image.open(io.BytesIO(binary)).convert("RGB")
    if atlas.size != (6 * SIZE, 5 * SIZE):
        raise ValueError(f"Unexpected 26-portrait atlas size: {atlas.size}")
    ROOT.mkdir(parents=True, exist_ok=True)
    for i, (key, _) in enumerate(KEYS):
        x, y = (i % 6) * SIZE, (i // 6) * SIZE
        photo = atlas.crop((x, y, x + SIZE, y + SIZE))
        photo.save(ROOT / f"{key}.webp", format="WEBP", quality=88, method=6)
    manifest = {
        "schemaVersion": 1,
        "kind": "fictional-ai-portraits",
        "notes": "AI-generated fictional personas; images are not photographs of named real professionals. 128px app thumbnails; use original 384px asset archive for high-resolution screens.",
        "portraits": [
            {"key": key, "displayName": name,
             "asset": f"assets/masana/portraits/{key}.webp"}
            for key, name in KEYS
        ],
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for part in parts:
        part.unlink()
    print(f"Materialized {len(KEYS)} AI photo portraits under {ROOT.relative_to(REPO)}")

if __name__ == "__main__":
    main()
