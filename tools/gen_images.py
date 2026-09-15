#!/usr/bin/env python3
"""Ada Macerası — gerçekçi ortam görsellerini üretir (OpenAI Images API).

Kullanım:
    python3 tools/gen_images.py w1 w5        # seçili görseller
    python3 tools/gen_images.py --all        # hepsi
    python3 tools/gen_images.py --list       # üretilecekleri listele

Anahtar: ~/.hermes/.env içindeki OPENAI_API_KEY
Çıktı:   assets/bg/<ad>.png
"""
import base64
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "bg"

STYLE = (
    " Painterly semi-realistic digital illustration for a children's adventure game, "
    "rich detail, warm cinematic lighting, vibrant friendly colors, depth and atmosphere, "
    "wide cinematic composition with calm empty space in the lower middle for game UI, "
    "absolutely no text, no letters, no numbers, no watermark, no logo, no people, no children."
)

SCENES = {
    # --- ortamlar (manzara) ---
    "w1": ("Çayır Adası", "A sunny green meadow with a winding dirt path leading to distant hills, "
                          "colorful wildflowers, tall grass, a few friendly bushes, soft cumulus clouds "
                          "in a bright blue sky, gentle morning light."),
    "w2": ("Orman Adası", "A lush green forest trail between tall old trees, golden sunbeams streaming "
                          "through the leaves, mossy boulders, ferns and mushrooms along the path, "
                          "soft mist in the distance, magical and inviting."),
    "w3": ("Kristal Mağara", "The interior of a vast crystal cave, huge luminous purple and blue crystals "
                             "growing from walls and ceiling, glowing stalactites, a wet reflective floor, "
                             "soft magical light, mysterious but not scary."),
    "w4": ("Gökkuşağı Zirvesi", "A high mountain summit above a sea of clouds with a huge rainbow arch, "
                                "a wooden rope bridge spanning a green valley, pink and golden sunset sky, "
                                "snowy peaks in the far distance, dreamy pastel light."),
    "w5": ("Ejderha Kalesi", "A friendly medieval stone castle with towers and red banners on a rocky hill "
                             "at dusk, dramatic orange and violet sky, a distant dragon silhouette flying "
                             "far away, torches glowing, epic adventure mood, not frightening."),
    # --- ekranlar ---
    "hero": ("Ana ekran", "A magical adventure world seen from a high viewpoint: five islands floating in a "
                          "turquoise ocean, one with a green meadow, one with a dense forest, one with glowing "
                          "crystals, one with a rainbow bridge, one with a stone castle, warm golden hour light, "
                          "clouds, seabirds, storybook realism."),
    "duel": ("Düello", "A wooden tournament arena on a sunny hill, two empty wooden podiums, colorful flags "
                       "and balloons, green grass, blue sky with soft clouds, festive and friendly, "
                       "wide empty center area."),
    "result": ("Kutlama", "A celebration sky with golden confetti, ribbons and small fireworks over soft "
                          "pastel clouds, warm light from the side, dreamy and joyful, mostly empty center."),
}

AVATAR_STYLE = (
    " Cute stylized 3D character render in the style of a modern animated family film, "
    "friendly big eyes, soft studio lighting, plain smooth pastel background, centered head and shoulders "
    "portrait, square composition, absolutely no text, no watermark."
)

AVATARS = {
    "fox": "A cheerful orange fox cub",
    "panda": "A happy fluffy giant panda cub",
    "tiger": "A playful young tiger cub",
    "frog": "A smiling little green frog",
    "owl": "A wise friendly brown owl",
    "octopus": "A cute purple octopus with big eyes",
    "unicorn": "A magical white unicorn foal with a pastel mane",
    "bee": "A chubby friendly bumble bee",
    "turtle": "A calm smiling green turtle",
    "lion": "A brave smiling little lion cub with a fluffy golden mane",
    "koala": "A sleepy adorable koala",
    "penguin": "A happy little emperor penguin chick",
}

MASCOTS = {
    "pofi": ("A cheerful cartoon-realistic young fox explorer standing on a path, wearing a small green "
             "backpack and a tiny explorer hat, waving one paw, full body, big friendly eyes, warm smile, "
             "soft shaded 3D look like a modern animated family film, standing on transparent-looking plain "
             "light background, centered, absolutely no text, no watermark."),
}


def api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key.strip()
    env = pathlib.Path.home() / ".hermes" / ".env"
    if env.exists():
        for line in env.read_text(errors="ignore").splitlines():
            if line.strip().startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY bulunamadı")


def generate(prompt: str, dest: pathlib.Path, size: str = "1536x1024", quality: str = "medium") -> dict:
    key = api_key()
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": size,
        "quality": quality,
        "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")[:400]
        raise SystemExit(f"API hatası {e.code}: {detail}")

    item = (data.get("data") or [{}])[0]
    if item.get("b64_json"):
        raw = base64.b64decode(item["b64_json"])
    elif item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=300) as r:
            raw = r.read()
    else:
        raise SystemExit(f"Beklenmeyen yanıt: {str(data)[:300]}")

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)
    usage = data.get("usage") or {}
    return {"path": str(dest), "bytes": len(raw), "usage": usage}


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] == "--list":
        print("Ortamlar (1536x1024):", ", ".join(sorted(SCENES)))
        print("Karakterler (1024x1024):", ", ".join(sorted(AVATARS)))
        print("Seçenekler: --all | w1 w2 | av:fox av:panda | --quality=low|medium|high")
        return

    quality = "medium"
    for a in list(args):
        if a.startswith("--quality="):
            quality = a.split("=", 1)[1]
            args.remove(a)

    if args == ["--all"]:
        args = sorted(SCENES) + [f"av:{k}" for k in AVATARS] + [f"po:{k}" for k in MASCOTS]

    total = 0
    for name in args:
      try:
        if name.startswith("po:"):
            slug = name[3:]
            prompt = MASCOTS.get(slug)
            if not prompt:
                print(f"⚠️ bilinmeyen maskot: {slug}")
                continue
            dest = ROOT / "assets" / "mascot" / f"{slug}.png"
            info = generate(prompt, dest, size="1024x1024", quality=quality)
        elif name.startswith("av:"):
            slug = name[3:]
            desc = AVATARS.get(slug)
            if not desc:
                print(f"⚠️ bilinmeyen karakter: {slug}")
                continue
            dest = ROOT / "assets" / "avatars" / f"{slug}.png"
            info = generate(desc + "." + AVATAR_STYLE, dest, size="1024x1024", quality=quality)
        else:
            scene = SCENES.get(name)
            if not scene:
                print(f"⚠️ bilinmeyen görsel: {name}")
                continue
            dest = OUT / f"{name}.png"
            info = generate(scene[1] + STYLE, dest, size="1536x1024", quality=quality)
        total += info["bytes"]
        print(f"✅ {name} → {info['path']} ({info['bytes'] // 1024} KB) {info.get('usage') or ''}")
      except SystemExit as e:
        print(f"❌ {name} atlandı: {e}")
        continue
    print(f"toplam {total // 1024} KB yazıldı")


if __name__ == "__main__":
    main()
