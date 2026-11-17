import json, sys, colorsys
from collections import Counter
from PIL import Image, ImageDraw
import numpy as np

data = json.load(open(sys.argv[1]))
tex = Image.open(sys.argv[2]).convert("RGB")
out_mask, out_albedo, sz = sys.argv[3], sys.argv[4], 2048
V = data["verts"]

def cls(b):
    b = b.lower()
    if "foot" in b or "toe" in b: return "boots"
    if "calf" in b: return "socks"
    if "thigh" in b or "pelvis" in b or b == "bip01": return "shorts"
    if "spine" in b or "clavicle" in b or "upperarm" in b or "neck" in b: return "shirt"
    return "skin"

lab = Image.new("L", (sz, sz), 0)  # 0 skin/other,1 shirt,2 shorts,3 socks,4 boots
d = ImageDraw.Draw(lab)
code = {"skin": 0, "shirt": 1, "shorts": 2, "socks": 3, "boots": 4}
for g in data["groups"]:
    if g["material"] != 0: continue
    for t in range(g["start"], g["start"] + g["count"], 3):
        tri = V[t:t + 3]
        c = Counter(cls(v[5]) for v in tri).most_common(1)[0][0]
        pts = [(v[3] * sz, (1 - v[4]) * sz) for v in tri]
        d.polygon(pts, fill=code[c])
lab = np.array(lab)
rgb = np.asarray(tex.resize((sz, sz))).astype(np.float32) / 255
r, g_, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx, mn = rgb.max(-1), rgb.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
hue = np.zeros_like(mx)
# teinte approximative (degrés) pour repérer peau et orange
with np.errstate(invalid="ignore", divide="ignore"):
    hr = np.where(mx == r, ((g_ - b) / (mx - mn + 1e-6)) % 6, 0)
    hg = np.where(mx == g_, (b - r) / (mx - mn + 1e-6) + 2, 0)
    hb = np.where(mx == b, (r - g_) / (mx - mn + 1e-6) + 4, 0)
hue = np.select([mx == r, mx == g_], [hr, hg], hb) * 60
skin = (hue > 5) & (hue < 40) & (sat > 0.18) & (sat < 0.65) & (mx > 0.25)
orange = ((hue < 25) | (hue > 345)) & (sat > 0.6) & (mx > 0.45)
H, W = lab.shape
yy, xx = np.mgrid[0:H, 0:W] / sz
sponsor = (xx > 0.40) & (xx < 0.60) & (yy > 0.55) & (yy < 0.70)
# Sponsor et écusson : tissu du maillot, même si les bords des lettres ressemblent à de la peau.
kit = (lab >= 1) & (lab <= 3) & (~skin | ((lab == 1) & sponsor))
mask = np.zeros((H, W, 4), np.uint8)
mask[..., 0] = np.where(kit & (lab == 1), 255, 0)
mask[..., 1] = np.where(kit & orange & ~sponsor, 255, 0)
mask[..., 2] = np.where(kit & (lab == 2), 255, 0)
mask[..., 3] = np.where(kit & (lab == 3), 255, 0)
# Albedo : tissu uni très clair (la teinte de l'équipe le colore), plis rendus par la carte de normales.
alb = (rgb * 255).astype(np.uint8)
flat = np.full((H, W, 3), 236, np.uint8)
alb = np.where(kit[..., None], flat, alb)
Image.fromarray(mask, "RGBA").resize((1024, 1024), Image.NEAREST).save(out_mask)
Image.fromarray(alb).resize((1024, 1024), Image.LANCZOS).save(out_albedo, quality=88)
prev = np.zeros((H, W, 3), np.uint8)
prev[mask[..., 0] > 0] = (30, 80, 220); prev[mask[..., 1] > 0] = (250, 200, 0); prev[mask[..., 2] > 0] = (240, 240, 240); prev[mask[..., 3] > 0] = (200, 30, 30)
prev[(lab == 4)] = (60, 60, 60)
Image.fromarray(prev).resize((768, 768)).save("/tmp/mask-preview.png")
print("kit px", kit.mean())
