#!/usr/bin/env python3
"""
SGOU Academic Database — Asset & Open Graph Media Generator
Generates high-definition, pixel-perfect PNG touch icons, favicons,
and a 1200x630 social preview card (og-image.png) with pristine contrast,
modern academic typography, and zero visibility defects.
"""

import os
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = r"C:\Windows\Fonts"

def get_font(name, size):
    path = os.path.join(FONTS_DIR, name)
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def create_base_icon(size=512):
    """
    Creates the modern minimal squircle icon with Georgia bold monogram.
    Standardized, elegant, and crisp at all resolutions.
    """
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    radius = int(size * 0.22)
    # Deep obsidian squircle background
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(24, 22, 20, 255))
    # Crisp inner highlight stroke
    draw.rounded_rectangle([1, 1, size - 2, size - 2], radius=radius, outline=(255, 255, 255, 22), width=max(2, int(size * 0.008)))

    # Draw Georgia bold monogram "SG"
    font_sg = get_font("georgiab.ttf", int(size * 0.42))
    text = "SG"
    bbox = font_sg.getbbox(text)
    w = bbox[2] - bbox[0]
    
    # Exact optical centering
    tx = (size - w) // 2 - bbox[0]
    ty = int(size * 0.20)
    draw.text((tx, ty), text, font=font_sg, fill=(245, 240, 232, 255))

    # Terracotta accent bar below text
    bar_y = int(size * 0.73)
    bar_h = max(3, int(size * 0.024))
    bar_w = int(size * 0.66)
    bar_x = (size - bar_w) // 2
    draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], radius=bar_h // 2, fill=(184, 67, 47, 255))

    return im

def generate_icons():
    """Generates all standard PWA and touch icon formats."""
    print("Generating minimal touch icons...")
    base_icon = create_base_icon(512)
    base_icon.save("icon-512.png", "PNG", optimize=True)

    # 192x192
    icon_192 = base_icon.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save("icon-192.png", "PNG", optimize=True)

    # Apple touch icon (180x180)
    icon_180 = base_icon.resize((180, 180), Image.Resampling.LANCZOS)
    icon_180.save("apple-touch-icon.png", "PNG", optimize=True)

    # Favicon 32x32 & 16x16
    icon_32 = base_icon.resize((32, 32), Image.Resampling.LANCZOS)
    icon_32.save("favicon-32x32.png", "PNG", optimize=True)

    icon_16 = base_icon.resize((16, 16), Image.Resampling.LANCZOS)
    icon_16.save("favicon-16x16.png", "PNG", optimize=True)

    # Multi-frame favicon.ico
    base_icon.save("favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  -> icon-512.png, icon-192.png, apple-touch-icon.png, favicon-32x32.png, favicon.ico generated.")

def generate_og_image():
    """
    Generates a high-definition 1200x630 social card (og-image.png)
    with ultra-crisp contrast, zero overlapping text, and flawless visibility
    across Twitter/X, WhatsApp, LinkedIn, Discord, and search engines.
    """
    print("Generating ultra-high-visibility 1200x630 Open Graph preview card...")
    W, H = 1200, 630
    card = Image.new("RGBA", (W, H), (18, 16, 14, 255))

    # Controlled subtle corner ambient glow (properly alpha blended via separate layer)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for r in range(320, 0, -15):
        alpha = int((1 - r / 320) * 14)
        glow_draw.ellipse([1060 - r, 80 - r, 1060 + r, 80 + r], fill=(224, 107, 82, alpha))
    card = Image.alpha_composite(card, glow)
    draw = ImageDraw.Draw(card)

    # Outer protective frame border (ensures card pops cleanly on both light and dark social feeds)
    draw.rounded_rectangle([14, 14, W - 15, H - 15], radius=18, outline=(48, 44, 38, 255), width=2)

    # ================= 1. TOP HEADER BRANDING BAR =================
    # Icon squircle badge
    badge_size = 54
    icon_badge = create_base_icon(badge_size)
    card.paste(icon_badge, (56, 46), icon_badge)

    # Academic label beside badge
    font_mono_small = get_font("segoeuib.ttf", 14)
    draw.text((124, 52), "SGOU ACADEMIC DATABASE", font=font_mono_small, fill=(236, 230, 220, 255))

    # Status Pill
    font_pill_tag = get_font("segoeuib.ttf", 11)
    draw.rounded_rectangle([124, 73, 310, 95], radius=10, fill=(35, 30, 26, 255), outline=(184, 67, 47, 180), width=1)
    draw.text((134, 77), "OFFICIAL DIGITAL REPOSITORY", font=font_pill_tag, fill=(224, 107, 82, 255))

    # University Name (Top Right)
    font_univ = get_font("segoeuib.ttf", 13)
    univ_text = "SREE NARAYANA GURU OPEN UNIVERSITY \u00b7 KOLLAM, KERALA"
    ubox = font_univ.getbbox(univ_text)
    uw = ubox[2] - ubox[0]
    draw.text((W - 56 - uw, 60), univ_text, font=font_univ, fill=(160, 152, 140, 255))

    # Thin sleek divider line
    draw.line([(56, 114), (W - 56, 114)], fill=(40, 36, 31, 255), width=1)

    # ================= 2. HERO HEADLINE & PURPOSE =================
    # Primary Title (Large, crisp, uncompressed)
    font_title = get_font("georgiab.ttf", 50)
    draw.text((56, 132), "SGOU Academic Database", font=font_title, fill=(255, 255, 255, 255))

    # Secondary Subtitle (Vibrant Terracotta Coral)
    font_sub = get_font("segoeuib.ttf", 22)
    draw.text((56, 196), "Official Academic Portal for SLM Textbooks, Question Papers & Assignments", font=font_sub, fill=(224, 107, 82, 255))

    # Context Description (Clear, readable, high contrast)
    font_desc = get_font("segoeui.ttf", 17)
    draw.text((56, 230), "Free and open-access university curriculum repository covering 37 undergraduate, postgraduate, and FYUG programmes.", font=font_desc, fill=(188, 180, 168, 255))

    # ================= 3. 4 HIGH-IMPACT METRIC CARDS =================
    metric_cards = [
        {
            "number": "1,205",
            "label": "SLM Textbooks",
            "note": "Course Modules",
            "num_col": (52, 211, 153, 255),
            "lbl_col": (235, 248, 240, 255),
            "note_col": (140, 185, 160, 255),
            "bg": (16, 32, 24, 255),
            "border": (36, 80, 58, 255),
            "accent": (52, 211, 153, 255)
        },
        {
            "number": "959",
            "label": "Question Papers",
            "note": "Semester PYQs",
            "num_col": (96, 165, 250, 255),
            "lbl_col": (235, 242, 255, 255),
            "note_col": (140, 170, 210, 255),
            "bg": (16, 26, 42, 255),
            "border": (34, 62, 98, 255),
            "accent": (96, 165, 250, 255)
        },
        {
            "number": "77",
            "label": "Assignments",
            "note": "Continuous Eval.",
            "num_col": (251, 191, 36, 255),
            "lbl_col": (254, 246, 228, 255),
            "note_col": (195, 160, 100, 255),
            "bg": (34, 24, 12, 255),
            "border": (80, 56, 24, 255),
            "accent": (251, 191, 36, 255)
        },
        {
            "number": "37",
            "label": "Programmes",
            "note": "FYUG \u00b7 UG \u00b7 PG",
            "num_col": (192, 132, 252, 255),
            "lbl_col": (248, 238, 255, 255),
            "note_col": (175, 140, 205, 255),
            "bg": (28, 18, 40, 255),
            "border": (68, 42, 92, 255),
            "accent": (192, 132, 252, 255)
        }
    ]

    card_y = 274
    card_h = 118
    card_w = 254
    card_gap = 24
    start_x = 56

    font_num = get_font("segoeuib.ttf", 36)
    font_card_lbl = get_font("segoeuib.ttf", 16)
    font_card_note = get_font("segoeui.ttf", 13)

    for i, mc in enumerate(metric_cards):
        cx = start_x + i * (card_w + card_gap)
        # Card body
        draw.rounded_rectangle([cx, card_y, cx + card_w, card_y + card_h], radius=12, fill=mc["bg"], outline=mc["border"], width=1)
        # Top accent strip inside card
        draw.rounded_rectangle([cx + 1, card_y + 1, cx + card_w - 1, card_y + 5], radius=3, fill=mc["accent"])
        # Number
        draw.text((cx + 18, card_y + 16), mc["number"], font=font_num, fill=mc["num_col"])
        # Label
        draw.text((cx + 18, card_y + 64), mc["label"], font=font_card_lbl, fill=mc["lbl_col"])
        # Note
        draw.text((cx + 18, card_y + 88), mc["note"], font=font_card_note, fill=mc["note_col"])

    # ================= 4. FEATURE CAPABILITIES CONTAINER =================
    feat_y = 414
    feat_h = 86
    feat_w = W - 112
    draw.rounded_rectangle([56, feat_y, 56 + feat_w, feat_y + feat_h], radius=12, fill=(25, 23, 20, 255), outline=(46, 42, 37, 255), width=1)

    features = [
        {"title": "Instant Multi-Token Search", "desc": "Sub-100ms response time"},
        {"title": "Offline PWA Support", "desc": "Full offline study caching"},
        {"title": "Edge PDF Streaming", "desc": "Direct high-speed downloads"},
        {"title": "Universal Access", "desc": "100% Free \u00b7 No login required"}
    ]

    col_w = feat_w // 4
    font_f_title = get_font("segoeuib.ttf", 14)
    font_f_desc = get_font("segoeui.ttf", 12)

    for fi, f in enumerate(features):
        fx = 56 + fi * col_w + 20
        # Subtle separator between columns
        if fi > 0:
            draw.line([(56 + fi * col_w, feat_y + 16), (56 + fi * col_w, feat_y + feat_h - 16)], fill=(42, 38, 34, 255), width=1)
        # Bullet dot
        draw.ellipse([fx, feat_y + 28, fx + 6, feat_y + 34], fill=(224, 107, 82, 255))
        draw.text((fx + 14, feat_y + 22), f["title"], font=font_f_title, fill=(240, 235, 225, 255))
        draw.text((fx + 14, feat_y + 46), f["desc"], font=font_f_desc, fill=(155, 148, 136, 255))

    # ================= 5. BOTTOM FOOTER & VERIFICATION STRIP =================
    foot_y = 538
    draw.line([(56, foot_y - 14), (W - 56, foot_y - 14)], fill=(38, 34, 30, 255), width=1)

    # Left: Active Status + Canonical URL
    draw.ellipse([58, foot_y + 6, 68, foot_y + 16], fill=(52, 211, 153, 255))
    font_url = get_font("segoeuib.ttf", 15)
    draw.text((76, foot_y + 2), "sgou-slm-database.vercel.app", font=font_url, fill=(235, 230, 222, 255))

    url_box = font_url.getbbox("sgou-slm-database.vercel.app")
    url_w = url_box[2] - url_box[0]
    font_live = get_font("segoeui.ttf", 14)
    draw.text((76 + url_w + 14, foot_y + 3), "\u00b7 Open Educational Resource", font=font_live, fill=(145, 138, 126, 255))

    # Right: Author Credit
    font_author = get_font("segoeuib.ttf", 15)
    auth_text = "Curated & Engineered by Ahayas"
    abox = font_author.getbbox(auth_text)
    aw = abox[2] - abox[0]
    draw.text((W - 56 - aw, foot_y + 2), auth_text, font=font_author, fill=(224, 107, 82, 255))

    # Save optimized PNG
    final_card = card.convert("RGB")
    final_card.save("og-image.png", "PNG", optimize=True)
    print("  -> og-image.png successfully created (1200x630, ultra-high contrast).")

if __name__ == "__main__":
    generate_icons()
    generate_og_image()
    print("All branding and media assets successfully regenerated!")
