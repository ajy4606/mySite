"""Make colour-managed website derivatives without changing the original."""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
VARIANTS = (("", 1600, 92), ("-sm", 800, 88), ("-full", 3000, 95))


def to_srgb(image):
    """Convert pixel values before embedding sRGB; never just relabel P3/Adobe RGB."""
    profile = image.info.get("icc_profile")
    oriented = ImageOps.exif_transpose(image)
    alpha = oriented.convert("RGBA").getchannel("A") if "A" in oriented.getbands() or "transparency" in oriented.info else None
    pixels = oriented if oriented.mode in ("RGB", "CMYK", "L", "LAB") else oriented.convert("RGB")
    if profile:
        source_profile = ImageCms.ImageCmsProfile(io.BytesIO(profile))
        pixels = ImageCms.profileToProfile(
            pixels, source_profile, SRGB, outputMode="RGB",
            renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
            flags=ImageCms.Flags.BLACKPOINTCOMPENSATION,
        )
    else:
        if pixels.mode in ("CMYK", "LAB"):
            raise ValueError("CMYK/Lab original needs an embedded colour profile")
        pixels = pixels.convert("RGB")
    if alpha is not None:
        background = Image.new("RGB", pixels.size, (0, 0, 0))
        background.paste(pixels, mask=alpha)
        pixels = background
    return pixels


def convert(source, output, number):
    with Image.open(source) as original:
        image = to_srgb(original)
    results, encoded = {}, []
    for suffix, maximum, quality in VARIANTS:
        scale = min(1, maximum / max(image.size))
        size = tuple(max(1, round(d * scale)) for d in image.size)
        resized = image.resize(size, Image.Resampling.LANCZOS) if size != image.size else image
        buffer = io.BytesIO()
        resized.save(buffer, "JPEG", quality=quality, subsampling=0,
                     optimize=True, progressive=True, icc_profile=SRGB.tobytes())
        data = buffer.getvalue()
        filename = f"{number}{suffix}.jpg"
        results[suffix or "display"] = {
            "name": filename, "w": size[0], "h": size[1],
            "version": hashlib.sha256(data).hexdigest()[:12],
        }
        encoded.append((filename, data))
    # Decode and encode all three successfully before replacing any web copy.
    output.mkdir(parents=True, exist_ok=True)
    for filename, data in encoded:
        target = output / filename
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--number", required=True)
    args = parser.parse_args()
    print(json.dumps(convert(args.source, args.output, args.number)))
