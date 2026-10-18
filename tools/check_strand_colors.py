"""One-case color audit: reuse the saved paper command, changing only output.

Also render the incorrect website palette with otherwise identical settings,
so the difference cannot be attributed to resolution, camera or thickness.
"""
import json
import os
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path("/root/output/testset_showcase_20260923_views30_v6")
OUT = Path("/tmp/hairflow-strand-color-audit")
OUT.mkdir(exist_ok=True)
source = json.loads((SOURCE / "sources.json").read_text())[0]
job = next(job for job in json.loads((SOURCE / "render_jobs.json").read_text())
           if job["target"] == source["strand_views"][1])
env = dict(os.environ, CUDA_VISIBLE_DEVICES="0", OPENBLAS_NUM_THREADS="1")
env.pop("LD_LIBRARY_PATH", None)
commands = {}
for kind in ("paper_random", "website_palette"):
    cmd = list(job["command"])
    cmd[cmd.index("--out") + 1] = str(OUT / f"{kind}.png")
    if kind == "website_palette":
        cmd.remove("--per_strand_color")
        cmd += ["--per_strand_palette", "--strand_palette", "default", "--strand_color_gain", ".85"]
    with (OUT / f"{kind}.log").open("w") as log:
        subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=900)
    commands[kind] = cmd
images = [source["strand_views"][1], OUT / "website_palette.png", OUT / "paper_random.png"]
panel = Image.new("RGB", (512 * 3, 550), "white")
draw = ImageDraw.Draw(panel)
for i, (path, label) in enumerate(zip(images, [
    "Original paper render", "Incorrect website palette", "Original per-strand random mapping"])):
    image = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", image.size, "white")
    bg.alpha_composite(image)
    panel.paste(bg.convert("RGB").resize((512,512)), (i*512,38))
    draw.text((i*512+12,12), label, fill="black")
preview = ROOT / "website/preview/strand-color-audit.jpg"
panel.save(preview, quality=95)
(OUT / "commands.json").write_text(json.dumps(commands, indent=2))
print(f"DONE {preview}", flush=True)
