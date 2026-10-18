"""Blender entry point: reuse the paper mesh renderer, then rotate its camera.

Pass the usual render_mesh_simple.py arguments, plus --orbit_camera JSON.
The camera JSON is produced by the strand renderer so both panes match exactly.
"""
import json
import runpy
import sys
from pathlib import Path

flag = sys.argv.index("--orbit_camera")
orbit_path = Path(sys.argv[flag + 1])
del sys.argv[flag:flag + 2]
orbit = json.loads(orbit_path.read_text())
namespace = runpy.run_path(str(Path(__file__).resolve().parents[2] / "blender/render_mesh_simple.py"))
bpy = namespace["bpy"]
camera = namespace["cam_obj"]
scene = namespace["sc"]
scene.render.use_persistent_data = True
folder = Path(namespace["args"].out).parent
for index, view in enumerate(orbit["views"][1:], 1):
    camera.location = view["location"]
    camera.rotation_euler = view["rotation_euler"]
    basis = camera.rotation_euler.to_matrix()
    for axis, dot in enumerate(namespace["camera_dots"]):
        dot.inputs[1].default_value = tuple(basis.col[axis])
    scene.render.filepath = str(folder / f"view_{index:03d}.png")
    bpy.ops.render.render(write_still=True)
