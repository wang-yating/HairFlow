"""Build a clean, self-contained GitHub-ready ZIP from validated final assets.

Development provenance, server paths, screenshots and offline tools remain
local; only runtime assets and a short public README enter the release.
"""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT.parent / "HairFlow-website.zip"
cases = json.loads((ROOT / "assets/turntables/manifest.json").read_text())
assert len(cases) == 12
public = []
for case in cases:
    assert case["frames"] == 8 and case["frameSize"] == 512
    assert "original-index random HSV" in case["geometry_provenance"]["materials"]
    public.append({key: case[key] for key in (
        "id", "name", "input", "sketch", "frames", "columns", "rows",
        "frameSize", "sheets", "posters")})

files = {}
for name in ("index.html", "style.css", "script.js", "assets/favicon.svg"):
    files[name] = (ROOT / name).read_bytes()
for directory in ("assets/images", "assets/videos"):
    for path in (ROOT / directory).iterdir():
        if path.is_file():
            files[str(path.relative_to(ROOT))] = path.read_bytes()
for case in public:
    for name in (*case["sheets"], *case["posters"]):
        with Image.open(ROOT / name) as image:
            assert image.size == ((2048, 1024) if name in case["sheets"] else (512, 512))
            image.verify()
        files[name] = (ROOT / name).read_bytes()
files["assets/cases.js"] = ("window.HAIRFLOW_CASES = " +
                           json.dumps(public, ensure_ascii=False, indent=2) + ";\n").encode()
files[".nojekyll"] = b""
files["README.md"] = b"""# HairFlow project website

HairFlow: Modeling 3D Hair Strands with Multi-Modal Conditioned Diffusion

## Publish

Extract this ZIP and upload its **contents** to your website repository.
`index.html`, `style.css`, `script.js`, `.nojekyll`, and `assets/` belong at the
repository root (or together in your chosen static-site publishing directory).
Enable GitHub Pages for that directory. No build step is required.

## Local preview

Open `index.html` directly, or run:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Contents and controls

- Paper title, authors, affiliations, teaser and abstract.
- Method diagram, 12 examples (4 per page), comparisons and wind simulations.
- Use Previous / numbered pages / Next at the top or bottom of the results.
- Drag either mesh or strands to rotate both simultaneously.
- Each example has 8 pre-rendered views; the angle slider and Reset also work.
- The website uses local images, videos and vanilla JavaScript only.
- No backend, CDN, external fonts, WebGL, 3D model downloads or API keys.

The paired views use the paper's mesh-normal material and the authors'
confirmed per-strand random color mapping. They are pre-rendered images,
not real-time 3D. All runtime assets are included in this archive.
"""


class References(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("src", "href", "poster") and value and not value.startswith("#"):
                assert value.split("?")[0] in files, value


References().feed(files["index.html"].decode())
for case in public:
    for name in (case["input"], case["sketch"], *case["sheets"], *case["posters"]):
        assert name in files
for name, data in files.items():
    if name.endswith((".html", ".css", ".js", ".md", ".svg")):
        assert b"/root/" not in data and b"/tmp/" not in data and b"/apdcephfs" not in data, name
    assert not name.startswith("/") and ".." not in Path(name).parts

temporary = DEST.with_suffix(".zip.partial")
with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, data in sorted(files.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(temporary) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
temporary.replace(DEST)
digest = hashlib.sha256(DEST.read_bytes()).hexdigest()
DEST.with_suffix(".zip.sha256").write_text(f"{digest}  {DEST.name}\n")
print(f"PASS: {DEST}\n{len(files)} files; {DEST.stat().st_size / 1024**2:.2f} MiB\nSHA256 {digest}")
