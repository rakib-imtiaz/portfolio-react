"""Make the full-page captures smaller: JPEG to WebP (quality 80).

Run it after `node tools/sync-assets.mjs`:
    python tools/shrink-captures.py [path to the concepts folder]   (default: ../concepts)

Always run the sync first: it resets content.json to the JPEG names that this
script looks for. It reads the original JPEGs from the concepts folder (never the
copies in public/), so a second run gives no second loss of quality. It writes
public/media/<id>/desktop-full.webp and mobile-full.webp, removes the copied JPEGs
from public/, and points content.json at the WebP files.
Only the project view shows these images. They are never WebGL textures.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "concepts"))
WEBP_MAX = 16383  # WebP cannot be taller or wider than this

path = os.path.join(PUB, "content.json")
with open(path, encoding="utf-8") as f:
    content = json.load(f)

before = after = 0
for site in content["sites"]:
    for key in ("full", "fullMobile"):
        m = site["media"].get(key)
        if not m:
            continue
        name = os.path.basename(m["src"])                      # desktop-full.jpg
        src = os.path.join(SRC, "_shared", "media", site["id"], name)
        if not os.path.exists(src):                            # the original has another name (one site)
            continue
        im = Image.open(src).convert("RGB")
        if max(im.size) > WEBP_MAX:
            continue                                           # keep the JPEG
        out_name = os.path.splitext(name)[0] + ".webp"
        out = os.path.join(PUB, "media", site["id"], out_name)
        im.save(out, "WEBP", quality=80, method=6)
        before += os.path.getsize(src)
        after += os.path.getsize(out)
        old = os.path.join(PUB, "media", site["id"], name)
        if os.path.exists(old):
            os.remove(old)
        m["src"] = f"/media/{site['id']}/{out_name}"
        m["w"], m["h"] = im.size

with open(path, "w", encoding="utf-8") as f:
    json.dump(content, f, ensure_ascii=False, separators=(",", ":"))

print(f"full captures: {before / 1048576:.1f} MB -> {after / 1048576:.1f} MB")
