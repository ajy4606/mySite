"""Add colour-managed 1200px derivatives; keep existing display/zoom files intact."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
import importlib.util

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("convert_image", ROOT / "tools/convert-image.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
FOLDERS = {"midore": "Midore", "full-metal-plant": "FullMetalPlant",
           "hwanggok-colorized": "Hwanggok_colorized", "hwanggok": "Hwanggok",
           "installation": "Installation"}


def build():
    manifest = json.loads((ROOT / "assets/works/manifest.json").read_text(encoding="utf-8-sig"))
    output = {}
    for item in manifest:
        display = item["file"].split("?")[0]
        original = ROOT / "images" / FOLDERS[item["project"]] / item["orig"]
        source = original if original.exists() else ROOT / item.get("full", item["file"]).split("?")[0]
        with Image.open(source) as image:
            pixels = converter.to_srgb(image)
        scale = min(1, 1200 / max(pixels.size))
        size = tuple(max(1, round(d * scale)) for d in pixels.size)
        resized = pixels.resize(size, Image.Resampling.LANCZOS) if size != pixels.size else pixels
        buffer = io.BytesIO()
        resized.save(buffer, "JPEG", quality=92, subsampling=0, optimize=True,
                     progressive=True, icc_profile=converter.SRGB.tobytes())
        data = buffer.getvalue()
        medium = display.replace(".jpg", "-md.jpg")
        target = ROOT / medium
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
        candidates = []
        for filename in [item.get("thumb"), medium + "?v=" + hashlib.sha256(data).hexdigest()[:12], item["file"]]:
            if not filename or not (ROOT / filename.split("?")[0]).exists():
                continue
            with Image.open(ROOT / filename.split("?")[0]) as image:
                width = image.width
            candidates.append({"src": filename, "width": width})
        # Some older installation files are already smaller than 1200px.
        unique = {}
        for candidate in candidates:
            unique[candidate["width"]] = candidate
        output[display] = sorted(unique.values(), key=lambda x: x["width"])
    (ROOT / "assets/works/responsive.json").write_bytes((json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(f"Responsive image sets: {len(output)}")


if __name__ == "__main__":
    build()
