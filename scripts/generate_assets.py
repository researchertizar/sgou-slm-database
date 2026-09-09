#!/usr/bin/env python3
"""
SGOU Academic Database — Asset & Open Graph Media Generator
Generates high-definition, pixel-perfect PNG touch icons, favicons,
and a 1200x630 social preview card (og-image.png) with pristine contrast,
modern academic typography, and zero visibility defects.
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
    Renders an enhanced, pixel-perfect, high-DPI (2x Retina) browser mockup framing
    the authentic live platform in the default Scholarly Warm Linen light theme,
    placed on a studio backdrop with realistic diffused depth.
    """
    print("Generating enhanced browser mockup for og-image.png (1200x630)...")
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    browser_exe = next((p for p in chrome_paths if os.path.exists(p)), None)
    if not browser_exe:
        print("  [!] Chrome/Edge executable not found; keeping existing og-image.png.")
        return

    import numpy as np
    from PIL import ImageFilter

    raw_temp_path = os.path.abspath("og_raw_retina.png")
    target_url = "http://localhost:3030/?og=1"

    # Capture in high-DPI (2x scale) for razor-sharp typography and borders
    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        "--virtual-time-budget=2000",
        f"--screenshot={raw_temp_path}",
        "--window-size=1200,640",
        target_url
    ]
    try:
        subprocess.run(cmd, check=True, timeout=25)
    except Exception as e:
        print(f"  [!] Failed to capture headless screenshot: {e}")
        return

    # Canvas and window specifications
    cw, ch = 1200, 630
    win_w = 1060
    title_h = 42
    vp_w = win_w
    vp_h = 504
    win_h = title_h + vp_h  # 546px

    win_x = (cw - win_w) // 2  # 70px
    win_y = (ch - win_h) // 2  # 42px
    radius = 14

    # 1. Studio Background: Warm Linen with soft radial spotlight
    y, x = np.ogrid[:ch, :cw]
    cx, cy = cw / 2.0, ch / 2.0 - 20
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    max_dist = np.sqrt((cw / 2.0)**2 + (ch / 2.0)**2)
    norm_dist = np.clip(dist / max_dist, 0, 1)

    vignette = 0.5 * (1 - np.cos(norm_dist * np.pi))
    r = 244 - vignette * 20
    g = 239 - vignette * 22
    b = 231 - vignette * 24
    bg_arr = np.dstack((r, g, b, np.full((ch, cw), 255))).astype(np.uint8)
    canvas = Image.fromarray(bg_arr, "RGBA")

    # 2. Multi-tier Diffused Drop Shadow
    shadow_ambient = Image.new("L", (cw, ch), 0)
    sdraw_a = ImageDraw.Draw(shadow_ambient)
    sdraw_a.rounded_rectangle([win_x, win_y + 16, win_x + win_w, win_y + win_h + 16], radius=radius + 4, fill=38)
    ambient_blur = shadow_ambient.filter(ImageFilter.GaussianBlur(32))

    shadow_dir = Image.new("L", (cw, ch), 0)
    sdraw_d = ImageDraw.Draw(shadow_dir)
    sdraw_d.rounded_rectangle([win_x, win_y + 8, win_x + win_w, win_y + win_h + 8], radius=radius, fill=30)
    dir_blur = shadow_dir.filter(ImageFilter.GaussianBlur(10))

    amb_arr = np.array(ambient_blur, dtype=float)
    dir_arr = np.array(dir_blur, dtype=float)
    tot_shadow = np.clip(amb_arr * 0.95 + dir_arr * 1.1, 0, 255).astype(np.uint8)

    shadow_layer = Image.fromarray(np.dstack([
        np.full((ch, cw), 24, dtype=np.uint8),
        np.full((ch, cw), 18, dtype=np.uint8),
        np.full((ch, cw), 12, dtype=np.uint8),
        tot_shadow
    ]), "RGBA")
    canvas.alpha_composite(shadow_layer)

    # 3. Browser Window Frame
    win_img = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(win_img)

    # Title bar background
    title_bg = (247, 244, 239, 255)
    wdraw.rounded_rectangle([0, 0, win_w - 1, win_h - 1], radius=radius, fill=title_bg)

    # Traffic light buttons with subtle rim
    traffic_y = title_h // 2
    traffic_r = 5.5
    buttons = [
        ((255, 95, 87, 255), (224, 68, 62, 255)),
        ((254, 188, 46, 255), (216, 158, 36, 255)),
        ((40, 200, 64, 255), (26, 171, 41, 255))
    ]
    for i, (fill_col, stroke_col) in enumerate(buttons):
        tx = 20 + i * 18
        wdraw.ellipse([tx - traffic_r, traffic_y - traffic_r, tx + traffic_r, traffic_y + traffic_r], fill=fill_col, outline=stroke_col, width=1)

    # Address bar pill
    pill_w, pill_h = 440, 26
    pill_x = (win_w - pill_w) // 2
    pill_y = (title_h - pill_h) // 2
    wdraw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=7,
        fill=(255, 255, 255, 240),
        outline=(220, 214, 204, 255),
        width=1
    )

    # Padlock icon
    lock_x = pill_x + 16
    lock_y = pill_y + 8
    wdraw.rectangle([lock_x, lock_y + 4, lock_x + 8, lock_y + 11], fill=(120, 114, 104, 255))
    wdraw.arc([lock_x + 1, lock_y, lock_x + 7, lock_y + 7], 180, 0, fill=(120, 114, 104, 255), width=1)

    # Address bar text
    try:
        font_url = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 12)
    except Exception:
        font_url = ImageFont.load_default()

    url_text = "https://sgou-slm-database.vercel.app"
    wdraw.text((lock_x + 16, pill_y + 5), url_text, font=font_url, fill=(110, 102, 92, 255))

    # Divider below title bar
    wdraw.line([(0, title_h - 1), (win_w, title_h - 1)], fill=(226, 220, 210, 255), width=1)

    # 4. Viewport Web Content (Downsampled from 2x Retina with Lanczos)
    raw_retina = Image.open(raw_temp_path).convert("RGBA")
    target_crop_h = int(2400 * (504 / 1060))
    raw_cropped = raw_retina.crop((0, 0, 2400, target_crop_h))
    vp_img = raw_cropped.resize((vp_w, vp_h), Image.Resampling.LANCZOS)

    win_img.paste(vp_img, (0, title_h))

    # Window subtle outer stroke
    wdraw.rounded_rectangle([0, 0, win_w - 1, win_h - 1], radius=radius, outline=(0, 0, 0, 22), width=1)

    # Window corner rounding mask
    corner_mask = Image.new("L", (win_w, win_h), 0)
    cm_draw = ImageDraw.Draw(corner_mask)
    cm_draw.rounded_rectangle([0, 0, win_w - 1, win_h - 1], radius=radius, fill=255)

    win_final = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
    win_final.paste(win_img, (0, 0), mask=corner_mask)

    # 5. Composite window onto studio canvas
    canvas.alpha_composite(win_final, (win_x, win_y))

    # 6. Save final og-image.png cleanly
    output_path = os.path.join(REPO_ROOT, "og-image.png")
    temp_output_path = os.path.join(REPO_ROOT, "og-image-temp.png")
    canvas.convert("RGB").save(temp_output_path, "PNG", optimize=True)
    if os.path.exists(output_path):
        try:
            os.remove(output_path)
        except OSError:
            pass
    os.replace(temp_output_path, output_path)
    print(f"  -> og-image.png successfully generated with enhanced browser mockup ({cw}x{ch})!")

    # Cleanup temp capture
    if os.path.exists(raw_temp_path):
        try:
            os.remove(raw_temp_path)
        except OSError:
            pass

def generate_og_image_dark():
    """
    Renders an ultra-premium, high-DPI (2x Retina) dark-mode browser mockup
    framing the authentic live platform in dark theme, placed on a moody graphite studio backdrop.
    """
    print("Generating dark-mode browser mockup for og-image-dark.png (1200x630)...")
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    browser_exe = next((p for p in chrome_paths if os.path.exists(p)), None)
    if not browser_exe:
        print("  [!] Chrome/Edge executable not found; keeping existing dark image.")
        return

    import numpy as np
    from PIL import ImageFilter

    raw_temp_path = os.path.join(REPO_ROOT, "og_raw_retina_dark.png")
    target_url = "http://localhost:3030/?og=1&theme=dark"

    # Capture in high-DPI (2x scale) with dark theme
    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        "--virtual-time-budget=2000",
        f"--screenshot={raw_temp_path}",
        "--window-size=1200,640",
        target_url
    ]
    try:
        subprocess.run(cmd, check=True, timeout=25)
    except Exception as e:
        print(f"  [!] Failed to capture headless dark screenshot: {e}")
        return

    cw, ch = 1200, 630
    win_w = 1060
    title_h = 42
    vp_w = win_w
    vp_h = 504
    win_h = title_h + vp_h  # 546px

    win_x = (cw - win_w) // 2  # 70px
    win_y = (ch - win_h) // 2  # 42px
    radius = 14

    # 1. Dark Studio Backdrop with subtle warm radial spotlight
    y, x = np.ogrid[:ch, :cw]
    cx, cy = cw / 2.0, ch / 2.0 - 20
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    max_dist = np.sqrt((cw / 2.0)**2 + (ch / 2.0)**2)
    norm_dist = np.clip(dist / max_dist, 0, 1)

    vignette = 0.5 * (1 - np.cos(norm_dist * np.pi))
    r = 38 - vignette * 23
    g = 34 - vignette * 20
    b = 30 - vignette * 18
    bg_arr = np.dstack((r, g, b, np.full((ch, cw), 255))).astype(np.uint8)
    canvas = Image.fromarray(bg_arr, "RGBA")

    # 2. Deep Realistic Shadow
    shadow_ambient = Image.new("L", (cw, ch), 0)
    sdraw_a = ImageDraw.Draw(shadow_ambient)
    sdraw_a.rounded_rectangle([win_x, win_y + 18, win_x + win_w, win_y + win_h + 18], radius=radius + 4, fill=120)
    ambient_blur = shadow_ambient.filter(ImageFilter.GaussianBlur(36))

    shadow_dir = Image.new("L", (cw, ch), 0)
    sdraw_d = ImageDraw.Draw(shadow_dir)
    sdraw_d.rounded_rectangle([win_x, win_y + 10, win_x + win_w, win_y + win_h + 10], radius=radius, fill=90)
    dir_blur = shadow_dir.filter(ImageFilter.GaussianBlur(14))

    amb_arr = np.array(ambient_blur, dtype=float)
    dir_arr = np.array(dir_blur, dtype=float)
    tot_shadow = np.clip(amb_arr * 0.95 + dir_arr * 1.1, 0, 255).astype(np.uint8)

    shadow_layer = Image.fromarray(np.dstack([
        np.full((ch, cw), 5, dtype=np.uint8),
        np.full((ch, cw), 4, dtype=np.uint8),
        np.full((ch, cw), 3, dtype=np.uint8),
        tot_shadow
    ]), "RGBA")
    canvas.alpha_composite(shadow_layer)

    # 3. Browser Window Frame (Dark macOS)
    win_img = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(win_img)

    # Titlebar fill
    title_bg = (32, 29, 26, 255)
    wdraw.rounded_rectangle([0, 0, win_w - 1, win_h - 1], radius=radius, fill=title_bg)

    # Traffic light buttons
    traffic_y = title_h // 2
    traffic_r = 5.5
    buttons = [
        ((255, 95, 87, 255), (224, 68, 62, 255)),
        ((254, 188, 46, 255), (216, 158, 36, 255)),
        ((40, 200, 64, 255), (26, 171, 41, 255))
    ]
    for i, (fill_col, stroke_col) in enumerate(buttons):
        tx = 20 + i * 18
        wdraw.ellipse([tx - traffic_r, traffic_y - traffic_r, tx + traffic_r, traffic_y + traffic_r], fill=fill_col, outline=stroke_col, width=1)

    # Address bar pill (Dark mode)
    pill_w, pill_h = 440, 26
    pill_x = (win_w - pill_w) // 2
    pill_y = (title_h - pill_h) // 2
    wdraw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=7,
        fill=(42, 38, 34, 255),
        outline=(65, 58, 52, 255),
        width=1
    )

    # Padlock icon
    lock_x = pill_x + 16
    lock_y = pill_y + 8
    wdraw.rectangle([lock_x, lock_y + 4, lock_x + 8, lock_y + 11], fill=(160, 152, 140, 255))
    wdraw.arc([lock_x + 1, lock_y, lock_x + 7, lock_y + 7], 180, 0, fill=(160, 152, 140, 255), width=1)

    # Address bar text
    try:
        font_url = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 12)
    except Exception:
        font_url = ImageFont.load_default()

    url_text = "https://sgou-slm-database.vercel.app"
    wdraw.text((lock_x + 16, pill_y + 5), url_text, font=font_url, fill=(205, 198, 188, 255))

    # Divider line below titlebar
    wdraw.line([(0, title_h - 1), (win_w, title_h - 1)], fill=(48, 43, 39, 255), width=1)

    # 4. Viewport Web Content (Dark Mode)
    raw_retina = Image.open(raw_temp_path).convert("RGBA")
    target_crop_h = int(2400 * (504 / 1060))
    raw_cropped = raw_retina.crop((0, 0, 2400, target_crop_h))
    vp_img = raw_cropped.resize((vp_w, vp_h), Image.Resampling.LANCZOS)

    win_img.paste(vp_img, (0, title_h))

    # Window subtle outer stroke (Crisp outline on dark backdrop)
    wdraw.rounded_rectangle([0, 0, win_w - 1, win_h - 1], radius=radius, outline=(255, 255, 255, 28), width=1)

    # Window corner mask
    corner_mask = Image.new("L", (win_w, win_h), 0)
    cm_draw = ImageDraw.Draw(corner_mask)
    cm_draw.rounded_rectangle([0, 0, win_w - 1, win_h - 1], radius=radius, fill=255)

    win_final = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
    win_final.paste(win_img, (0, 0), mask=corner_mask)

    # 5. Composite onto dark canvas
    canvas.alpha_composite(win_final, (win_x, win_y))

    # 6. Save final og-image-dark.png cleanly
    output_path = os.path.join(REPO_ROOT, "og-image-dark.png")
    temp_output_path = os.path.join(REPO_ROOT, "og-image-dark-temp.png")
    canvas.convert("RGB").save(temp_output_path, "PNG", optimize=True)
    if os.path.exists(output_path):
        try:
            os.remove(output_path)
        except OSError:
            pass
    os.replace(temp_output_path, output_path)
    print(f"  -> og-image-dark.png successfully generated with dark browser mockup ({cw}x{ch})!")

    # Cleanup temp capture
    if os.path.exists(raw_temp_path):
        try:
            os.remove(raw_temp_path)
        except OSError:
            pass

if __name__ == "__main__":
    generate_icons()
    generate_og_image()
    generate_og_image_dark()
    print("All branding and media assets (light & dark) successfully regenerated!")
