#!/usr/bin/env python3
"""
EcoScan Product Lookup Server  — runs on localhost:5001
Provides barcode lookups: local DB → Open Food Facts → UPC Item DB
Start with:  python server.py
"""

import os, sys, json, base64, re
import numpy as np

from flask import Flask, jsonify, request, send_from_directory
try:
    from flask_cors import CORS
except ImportError:
    print("⚠️  flask-cors not found — installing now…")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flask-cors"])
    from flask_cors import CORS
import requests

# Serve static HTML files from the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)  # allow browser to call from any origin

# ── STATIC FILE ROUTES ────────────────────────────────────────────────
@app.route('/')
def serve_index():         return send_from_directory(BASE_DIR, 'index.html')
@app.route('/login')
def serve_login():         return send_from_directory(BASE_DIR, 'login.html')
@app.route('/dashboard')
def serve_dashboard():     return send_from_directory(BASE_DIR, 'dashboard.html')
@app.route('/scan')
def serve_scan():          return send_from_directory(BASE_DIR, 'ecoscan.html')
@app.route('/<path:filename>')
def serve_static(filename): return send_from_directory(BASE_DIR, filename)

# ── LOAD BARCODE / OCR ENGINES ──────────────────────────────────────────
import cv2

# pyzbar: reads actual barcode stripe patterns — primary decoder, <10ms
_pyzbar_available = False
try:
    from pyzbar.pyzbar import decode as pyzbar_decode
    from pyzbar.pyzbar import ZBarSymbol
    _pyzbar_available = True
    print("✅ pyzbar loaded — fast barcode decoding enabled")
except Exception as _e:
    print(f"⚠️  pyzbar not available ({_e}) — falling back to EasyOCR")

# cv2 built-in barcode detector — secondary decoder (~50ms)
_cv2_barcode_available = False
try:
    _cv2_bd = cv2.barcode.BarcodeDetector()
    _cv2_barcode_available = True
    print("✅ cv2.barcode.BarcodeDetector available")
except Exception:
    pass

# EasyOCR: deep-learning fallback only for unreadable/damaged barcodes
import easyocr
_easyocr_reader = None
def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        print("⚠️  Loading EasyOCR (slow fallback) — barcode was not machine-readable")
        _easyocr_reader = easyocr.Reader(['en'], gpu=False)
    return _easyocr_reader

_tesseract_available = False
try:
    import pytesseract
    pytesseract.get_tesseract_version()
    _tesseract_available = True
except Exception:
    try:
        import pytesseract
        for p in [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]:
            if os.path.isfile(p):
                pytesseract.pytesseract.tesseract_cmd = p
                _tesseract_available = True
                break
    except ImportError:
        pass

def validate_barcode(code):
    """Validate EAN-13, EAN-8, UPC-A checksums. Returns False for unrecognised lengths."""
    if not code or not code.isdigit():
        return False
    n = len(code)
    if n == 13:
        s = sum(int(code[i]) * (1 if i % 2 == 0 else 3) for i in range(12))
        return (10 - s % 10) % 10 == int(code[12])
    if n == 8:
        s = sum(int(code[i]) * (3 if i % 2 == 0 else 1) for i in range(7))
        return (10 - s % 10) % 10 == int(code[7])
    if n == 12:  # UPC-A
        s = sum(int(code[i]) * (3 if i % 2 == 0 else 1) for i in range(11))
        return (10 - s % 10) % 10 == int(code[11])
    return False  # strict — only accept known-length codes with valid checksum


def _detect_digit_strip(grey):
    """
    Locate the human-readable digit row that sits BELOW the barcode bars.
    Uses row-wise variance: barcode bars = very high variance (alternating black/white
    columns), digit text area = lower variance.
    Returns list of (crop, label) tuples.
    """
    h, w = grey.shape
    strips = []
    row_var = np.var(grey.astype(np.float32), axis=1)
    # barcode bar rows have highest variance
    hi_thresh = np.percentile(row_var, 65)
    bar_rows = np.where(row_var > hi_thresh)[0]
    if len(bar_rows) > 0:
        last_bar = int(bar_rows[-1])
        digit_start = min(last_bar + 1, h - 5)
        strip = grey[digit_start:, :]
        if strip.shape[0] >= 8:
            strips.append((strip, 'auto-digit-strip', digit_start, 0))
        wide_start = max(0, int(last_bar * 0.80))
        wide = grey[wide_start:, :]
        if wide.shape[0] >= 8:
            strips.append((wide, 'auto-wide-strip', wide_start, 0))
    return strips


def _score_candidate(code, valid, conf=1.0):
    """
    Score a barcode candidate.
    Indian EAN-13 barcodes start with 890 (GS1 India prefix) — leftmost digit is 8.
    """
    if not code or not code.isdigit():
        return -1
    s = 0
    if valid:
        s += 3000
    # Length bonuses
    if len(code) == 13: s += 60
    elif len(code) == 12: s += 40
    elif len(code) == 8:  s += 30
    # Indian prefix bonuses
    if code.startswith('890'): s += 500   # confirmed Indian EAN-13
    elif code.startswith('89'):  s += 300
    elif code.startswith('8'):   s += 150  # leftmost digit is 8 — likely Indian
    # EasyOCR confidence
    s += int(conf * 80)
    return s


def _ocr_one_crop(crop_in, label='', crop_y0=0, crop_x0=0, orig_h=1, orig_w=1):
    """
    Run OpenCV preprocessing + EasyOCR + PyTesseract on a single greyscale crop.
    Returns list of candidate dicts with 'bbox' (normalized 0-1 in original image space).
    """
    if crop_in is None or crop_in.shape[0] < 8 or crop_in.shape[1] < 20:
        return []

    ch_orig, cw_orig = crop_in.shape[:2]
    candidates = []

    # ── Scale up so digit text is at least 50 px tall (OCR works much better) ──
    v_scale = max(1.0, min(6.0, 60.0 / ch_orig))
    h_scale = max(1.0, min(4.0, 600.0 / cw_orig))
    if v_scale > 1.1 or h_scale > 1.1:
        crop = cv2.resize(crop_in, None, fx=h_scale, fy=v_scale,
                          interpolation=cv2.INTER_CUBIC)
    else:
        crop = crop_in
        v_scale = h_scale = 1.0

    # ── Build preprocessing variants ──
    variants = []

    # CLAHE: best for uneven lighting / camera glare
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    enhanced = clahe.apply(crop)
    _, otsu_enh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(('clahe-otsu',     otsu_enh))
    variants.append(('clahe-otsu-inv', cv2.bitwise_not(otsu_enh)))

    # Plain Otsu
    _, otsu = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(('otsu',     otsu))
    variants.append(('otsu-inv', cv2.bitwise_not(otsu)))

    # Adaptive threshold (handles shadows/gradients)
    blk = max(11, (crop.shape[0] // 4) | 1)  # must be odd
    adapt = cv2.adaptiveThreshold(crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, blk, 8)
    variants.append(('adaptive',     adapt))
    variants.append(('adaptive-inv', cv2.bitwise_not(adapt)))

    # Morphological clean (remove bar noise that bleeds into digit zone)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 1))
    morph = cv2.morphologyEx(otsu_enh, cv2.MORPH_OPEN, kernel)
    variants.append(('morph', morph))

    reader = get_easyocr_reader()

    for (prep_name, img) in variants:
        # ── EasyOCR ──
        try:
            results = reader.readtext(
                img,
                allowlist='0123456789',
                paragraph=False, detail=1,
                min_size=6,
                contrast_ths=0.05,
                adjust_contrast=0.5,
                text_threshold=0.5,
            )
            # Merge all digit fragments (OCR may split the 13-digit string)
            merged = ''.join(re.sub(r'\D', '', t) for (_, t, _) in results)
            avg_conf = (sum(c for (_, _, c) in results) / len(results)) if results else 0.5

            # Compute union bbox of all detected regions (in original image coords)
            merged_bbox = None
            if results:
                all_xs = [p[0] for (bb, _, _) in results for p in bb]
                all_ys = [p[1] for (bb, _, _) in results for p in bb]
                ix1 = crop_x0 + min(all_xs) / h_scale
                iy1 = crop_y0 + min(all_ys) / v_scale
                ix2 = crop_x0 + max(all_xs) / h_scale
                iy2 = crop_y0 + max(all_ys) / v_scale
                merged_bbox = {
                    'x': max(0.0, ix1 / orig_w), 'y': max(0.0, iy1 / orig_h),
                    'w': min(1.0, (ix2 - ix1) / orig_w), 'h': min(1.0, (iy2 - iy1) / orig_h)
                }

            for m in re.finditer(r'\d{8,14}', merged):
                code = m.group()
                valid = validate_barcode(code)
                sc = _score_candidate(code, valid, avg_conf)
                candidates.append({'code': code, 'valid': valid,
                                    'method': f'EasyOCR/{label}/{prep_name}',
                                    'score': sc, 'bbox': merged_bbox, 'conf': avg_conf})
            # Also try each result individually with its own bbox
            for (ocr_bb, text_val, conf) in results:
                digits = re.sub(r'\D', '', text_val)
                if 8 <= len(digits) <= 14:
                    xs = [p[0] for p in ocr_bb]; ys = [p[1] for p in ocr_bb]
                    ix1 = crop_x0 + min(xs) / h_scale
                    iy1 = crop_y0 + min(ys) / v_scale
                    ix2 = crop_x0 + max(xs) / h_scale
                    iy2 = crop_y0 + max(ys) / v_scale
                    ind_bbox = {
                        'x': max(0.0, ix1 / orig_w), 'y': max(0.0, iy1 / orig_h),
                        'w': min(1.0, (ix2 - ix1) / orig_w), 'h': min(1.0, (iy2 - iy1) / orig_h)
                    }
                    valid = validate_barcode(digits)
                    sc = _score_candidate(digits, valid, conf)
                    candidates.append({'code': digits, 'valid': valid,
                                       'method': f'EasyOCR/{label}/{prep_name}',
                                       'score': sc, 'bbox': ind_bbox, 'conf': conf})
        except Exception:
            pass

        # ── PyTesseract ──
        if _tesseract_available:
            try:
                import pytesseract
                for psm in (7, 6, 13):
                    cfg = f'--psm {psm} -c tessedit_char_whitelist=0123456789'
                    text = pytesseract.image_to_string(img, config=cfg)
                    digits = re.sub(r'\D', '', text)
                    for m in re.finditer(r'\d{8,14}', digits):
                        code = m.group()
                        valid = validate_barcode(code)
                        sc = _score_candidate(code, valid)
                        # Tesseract has no bbox — use crop position as estimate
                        est_bbox = {
                            'x': max(0.0, crop_x0 / orig_w),
                            'y': max(0.0, crop_y0 / orig_h),
                            'w': min(1.0, cw_orig / orig_w),
                            'h': min(1.0, ch_orig / orig_h)
                        }
                        candidates.append({'code': code, 'valid': valid,
                                           'method': f'Tesseract-psm{psm}/{label}/{prep_name}',
                                           'score': sc, 'bbox': est_bbox, 'conf': 0.85})
            except Exception:
                pass

    return candidates


def _try_prefix_fix(code, method):
    """
    If OCR dropped or misread the leading '8' (common for Indian barcodes),
    try inserting/replacing to make a valid EAN-13 starting with '8'.
    """
    if not code or not code.isdigit():
        return None, None
    # Case 1: 12 digits — try prepending '8' to make 13
    if len(code) == 12:
        candidate = '8' + code
        if validate_barcode(candidate):
            return candidate, method + '+Prepend8'
    # Case 2: 13 digits but first digit is wrong — try replacing it with '8'
    if len(code) == 13 and code[0] != '8':
        candidate = '8' + code[1:]
        if validate_barcode(candidate):
            return candidate, method + '+LeadingFix8'
    # Case 3: 14 digits — strip first digit if rest is valid
    if len(code) == 14:
        trimmed = code[1:]
        if validate_barcode(trimmed):
            return trimmed, method + '+TrimLeading'
        trimmed = code[:13]
        if validate_barcode(trimmed):
            return trimmed, method + '+TrimTrailing'
    return None, None


def _pyzbar_scan(img_bgr):
    """
    Stage 1: pyzbar — reads actual barcode stripes. <10ms. Primary decoder.
    Tries multiple preprocessed versions of the image for robustness.
    """
    if not _pyzbar_available:
        return None, None, 0, None

    h, w = img_bgr.shape[:2]
    grey = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Build quick preprocessing variants
    variants = [('raw', img_bgr)]

    # CLAHE-enhanced greyscale → usually helps with dim/washed-out barcodes
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(grey)
    variants.append(('clahe', cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)))

    # Sharpened: strong unsharp mask
    blurred = cv2.GaussianBlur(grey, (0, 0), 3)
    sharp = cv2.addWeighted(grey, 1.8, blurred, -0.8, 0)
    variants.append(('sharp', cv2.cvtColor(sharp, cv2.COLOR_GRAY2BGR)))

    # Upscale if image is small (pyzbar struggles below ~300px wide)
    if w < 400:
        scale = 400.0 / w
        big = cv2.resize(img_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
        variants.append(('upscale', big))

    syms = [ZBarSymbol.EAN13, ZBarSymbol.EAN8, ZBarSymbol.UPCA, ZBarSymbol.UPCE, ZBarSymbol.CODE128, ZBarSymbol.CODE39, ZBarSymbol.QRCODE]

    for (vname, vimg) in variants:
        try:
            decoded = pyzbar_decode(vimg, symbols=syms)
        except Exception:
            decoded = []
        for d in decoded:
            code = d.data.decode('utf-8', errors='ignore').strip()
            
            # If pyzbar reads a QR code, it might contain URLs or other characters.
            # We want to extract the longest digit sequence or exact digits.
            if not code.isdigit():
                import re
                m = re.search(r'\d{8,14}', code)
                if m:
                    code = m.group()
                else:
                    code = ''.join(filter(str.isdigit, code))
            
            if not code or not code.isdigit() or len(code) < 4:
                continue
                
            # Pyzbar decoding of QR and CODE128 is highly reliable with its own checksums,
            # so we can consider anything pyzbar safely returns as valid structural data.
            valid = True 
            
            # Build bbox from pyzbar rect (already in pixel coords)
            r = d.rect  # left, top, width, height
            bbox = {
                'x': max(0.0, r.left / w),
                'y': max(0.0, r.top / h),
                'w': min(1.0, r.width / w),
                'h': min(1.0, r.height / h),
            }
            return code, f'pyzbar/{vname}', 0.99, bbox

    return None, None, 0, None


def _cv2_barcode_scan(img_bgr):
    """
    Stage 2: OpenCV built-in BarcodeDetector. ~30-80ms. Secondary decoder.
    """
    if not _cv2_barcode_available:
        return None, None, 0, None
    h, w = img_bgr.shape[:2]
    try:
        retval, decoded_info, decoded_type, points = _cv2_bd.detectAndDecodeMulti(img_bgr)
        if retval:
            for code in decoded_info:
                code = (code or '').strip()
                if code.isdigit() and 8 <= len(code) <= 14:
                    valid = validate_barcode(code)
                    return code, 'cv2-barcode', 0.95, None
    except Exception:
        pass
    return None, None, 0, None


def ocr_read_barcode_number(img_bgr):
    """
    Fast pipeline:
      Stage 1 — pyzbar   : reads barcode stripes directly  (<10ms)
      Stage 2 — cv2      : OpenCV BarcodeDetector          (~50ms)
      Stage 3 — EasyOCR  : deep-learning fallback          (slow, last resort)

    Stages 1 & 2 are instant. EasyOCR only runs if the barcode is so damaged/
    blurry that the machine-readable bars cannot be decoded at all.
    """
    # ── Stage 1: pyzbar (primary, <10ms) ──────────────────────────────────
    code, method, conf, bbox = _pyzbar_scan(img_bgr)
    if code:
        return code, method, conf, bbox

    # ── Stage 2: cv2 BarcodeDetector (~50ms) ──────────────────────────────
    code, method, conf, bbox = _cv2_barcode_scan(img_bgr)
    if code:
        return code, method, conf, bbox

    # ── Stage 3: EasyOCR + digit-strip OCR (last resort — slow) ──────────
    h, w = img_bgr.shape[:2]
    grey = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    all_candidates = []

    for (strip, slabel, y0, x0) in _detect_digit_strip(grey):
        cands = _ocr_one_crop(strip, slabel, crop_y0=y0, crop_x0=x0, orig_h=h, orig_w=w)
        all_candidates.extend(cands)
        best_indian = next(
            (c for c in sorted(cands, key=lambda x: x['score'], reverse=True)
             if c['valid'] and c['code'].startswith('8')), None)
        if best_indian:
            return best_indian['code'], best_indian['method'], best_indian.get('conf', 0.9), best_indian.get('bbox')

    fixed_crops = [
        (grey[int(h * 0.78):, :], 'bottom-22%', int(h * 0.78), 0),
        (grey[int(h * 0.65):, :], 'bottom-35%', int(h * 0.65), 0),
        (grey[int(h * 0.50):, :], 'bottom-50%', int(h * 0.50), 0),
        (grey,                    'full',        0,              0),
    ]
    for (crop, clabel, y0, x0) in fixed_crops:
        cands = _ocr_one_crop(crop, clabel, crop_y0=y0, crop_x0=x0, orig_h=h, orig_w=w)
        all_candidates.extend(cands)
        best_valid = next(
            (c for c in sorted(cands, key=lambda x: x['score'], reverse=True)
             if c['valid']), None)
        if best_valid:
            return best_valid['code'], best_valid['method'], best_valid.get('conf', 0.9), best_valid.get('bbox')

    top_unvalidated = sorted(all_candidates, key=lambda c: c['score'], reverse=True)[:10]
    for cand in top_unvalidated:
        fixed_code, fixed_method = _try_prefix_fix(cand['code'], cand['method'])
        if fixed_code:
            return fixed_code, fixed_method, cand.get('conf', 0.7), cand.get('bbox')

    if all_candidates:
        best = max(all_candidates, key=lambda c: c['score'])
        return best['code'], best['method'], best.get('conf', 0.5), best.get('bbox')

    return None, None, 0, None

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'barcodes_cache.json')

# ── PRE-BUILT INDIAN & GLOBAL PRODUCT DATABASE ─────────────────────────────
# category keys must match CDB keys in ecoscan_logic.js
PREBUILT = {
    # ── HUL (Hindustan Unilever) ──
    "8901030854526": {"name": "Dove Body Wash",             "category": "shower_gel",       "brand": "Dove"},
    "8901030912817": {"name": "Dove Shampoo",               "category": "shampoo",          "brand": "Dove"},
    "8901030034582": {"name": "Surf Excel Detergent",        "category": "detergent",        "brand": "Surf Excel"},
    "8901030034605": {"name": "Vim Dishwash Bar",            "category": "dishwasher_tabs",  "brand": "Vim"},
    "8901030864044": {"name": "Lux Soap Bar",               "category": "soap_bar",         "brand": "Lux"},
    "8901030850283": {"name": "Lifebuoy Handwash",          "category": "shower_gel",       "brand": "Lifebuoy"},
    "8901030374126": {"name": "Rin Detergent Bar",          "category": "detergent",        "brand": "Rin"},
    "8901030796424": {"name": "Ponds Face Cream",           "category": "shower_gel",       "brand": "Ponds"},
    "8901030803283": {"name": "Closeup Toothpaste",         "category": "toothpaste",       "brand": "Closeup"},
    "8901030015763": {"name": "Clinic Plus Shampoo",        "category": "shampoo",          "brand": "Clinic Plus"},
    "8901030793737": {"name": "Sunsilk Shampoo",            "category": "shampoo",          "brand": "Sunsilk"},
    "8906188068349": {"name": "Personal Care Product",      "category": "shower_gel",       "brand": ""},
    "8906188088349": {"name": "Personal Care Tube",         "category": "shower_gel",       "brand": ""},
    # ── P&G India ──
    "8001841530369": {"name": "Head & Shoulders Shampoo",   "category": "shampoo",          "brand": "Head & Shoulders"},
    "8001841539683": {"name": "Pantene Shampoo",            "category": "shampoo",          "brand": "Pantene"},
    "8001841540689": {"name": "Ariel Detergent",            "category": "detergent",        "brand": "Ariel"},
    "8006540360262": {"name": "Gillette Shave Gel",         "category": "shower_gel",       "brand": "Gillette"},
    "8001841652535": {"name": "Oral-B Toothpaste",          "category": "toothpaste",       "brand": "Oral-B"},
    # ── Colgate-Palmolive ──
    "8901029073069": {"name": "Colgate Strong Teeth",       "category": "toothpaste",       "brand": "Colgate"},
    "8901029067464": {"name": "Palmolive Body Wash",        "category": "shower_gel",       "brand": "Palmolive"},
    "8901029195289": {"name": "Colgate MaxFresh",           "category": "toothpaste",       "brand": "Colgate"},
    # ── ITC Ltd ──
    "8904001520012": {"name": "Sunfeast Marie Biscuit",     "category": "cookies",          "brand": "Sunfeast"},
    "8904001518200": {"name": "Yippee Noodles",             "category": "pasta",            "brand": "Yippee"},
    "8904001526014": {"name": "Dark Fantasy Cookie",        "category": "cookies",          "brand": "Sunfeast"},
    "8904001516398": {"name": "Bingo Mad Angles",           "category": "chips",            "brand": "Bingo"},
    # ── Parle Products ──
    "8901719124648": {"name": "Parle-G",                    "category": "cookies",          "brand": "Parle"},
    "8901719124617": {"name": "Parle Krackjack",            "category": "cookies",          "brand": "Parle"},
    "8901719115027": {"name": "Hide & Seek Biscuit",        "category": "cookies",          "brand": "Parle"},
    # ── Britannia Industries ──
    "8901063022591": {"name": "Good Day Biscuit",           "category": "cookies",          "brand": "Britannia"},
    "8901063036208": {"name": "Digestive Marie",            "category": "cookies",          "brand": "Britannia"},
    "8901063021204": {"name": "50-50 Biscuit",              "category": "cookies",          "brand": "Britannia"},
    "8901063032576": {"name": "Bourbon Biscuit",            "category": "cookies",          "brand": "Britannia"},
    # ── Nestle India ──
    "8901058852147": {"name": "Maggi 2-Minute Noodles",     "category": "pasta",            "brand": "Maggi"},
    "8901058570329": {"name": "KitKat",                     "category": "chocolate",        "brand": "Nestle"},
    "8901058546394": {"name": "Munch Chocolate",            "category": "chocolate",        "brand": "Nestle"},
    "8901058520004": {"name": "Milkmaid Condensed Milk",    "category": "milk",             "brand": "Nestle"},
    "8901058855254": {"name": "Maggi Hot & Sweet Sauce",    "category": "vegetables",       "brand": "Maggi"},
    # ── Amul ──
    "8902102011218": {"name": "Amul Butter",                "category": "butter",           "brand": "Amul"},
    "8902102000007": {"name": "Amul Full Cream Milk",       "category": "milk",             "brand": "Amul"},
    "8902102113904": {"name": "Amul Processed Cheese",      "category": "cheese",           "brand": "Amul"},
    "8902102004562": {"name": "Amul Dahi",                  "category": "yogurt",           "brand": "Amul"},
    "8902102001562": {"name": "Amul Taaza Milk",            "category": "milk",             "brand": "Amul"},
    # ── Marico ──
    "8901259020063": {"name": "Saffola Gold Oil",           "category": "cooking_oil",      "brand": "Saffola"},
    "8901259990219": {"name": "Parachute Coconut Oil",      "category": "cooking_oil",      "brand": "Parachute"},
    "8901259141614": {"name": "Hair & Care",                "category": "shampoo",          "brand": "Hair & Care"},
    # ── Dabur ──
    "8901207008060": {"name": "Dabur Red Toothpaste",       "category": "toothpaste",       "brand": "Dabur"},
    "8901207016034": {"name": "Dabur Honey",                "category": "beverages",        "brand": "Dabur"},
    "8901207066879": {"name": "Vatika Shampoo",             "category": "shampoo",          "brand": "Dabur Vatika"},
    "8901207030090": {"name": "Real Fruit Juice",           "category": "juice",            "brand": "Dabur Real"},
    # ── Coca-Cola India ──
    "8901012030064": {"name": "Coca-Cola 600ml",            "category": "cola",             "brand": "Coca-Cola"},
    "8901012030071": {"name": "Sprite 600ml",               "category": "cola",             "brand": "Sprite"},
    "8901012180176": {"name": "Thums Up 600ml",             "category": "cola",             "brand": "Thums Up"},
    "8901012004434": {"name": "Limca",                      "category": "cola",             "brand": "Limca"},
    "8901012003536": {"name": "Minute Maid Juice",          "category": "juice",            "brand": "Minute Maid"},
    "8901012006629": {"name": "Maaza Mango Drink",          "category": "juice",            "brand": "Maaza"},
    # ── PepsiCo India ──
    "8901575010026": {"name": "Pepsi 600ml",                "category": "cola",             "brand": "Pepsi"},
    "8901575047053": {"name": "Lay's Classic Salted",       "category": "chips",            "brand": "Lay's"},
    "8901575040009": {"name": "Kurkure Masala Munch",       "category": "chips",            "brand": "Kurkure"},
    "8901575050021": {"name": "Lay's Magic Masala",         "category": "chips",            "brand": "Lay's"},
    "8901575011108": {"name": "7Up Nimbooz",                "category": "cola",             "brand": "7Up"},
    "8901575005015": {"name": "Mountain Dew",               "category": "cola",             "brand": "Mountain Dew"},
    "8901575032813": {"name": "Tropicana Orange 200ml",     "category": "juice",            "brand": "Tropicana"},
    # ── Haldiram ──
    "8904004600130": {"name": "Haldiram Aloo Bhujia",       "category": "chips",            "brand": "Haldiram"},
    "8904004604282": {"name": "Haldiram Mixture",           "category": "chips",            "brand": "Haldiram"},
    # ── ITC Biscuits ──
    "8904001510372": {"name": "Farmlite Digestive",         "category": "cookies",          "brand": "Sunfeast"},
    # ── Patanjali ──
    "8904093500109": {"name": "Patanjali Dant Kanti",       "category": "toothpaste",       "brand": "Patanjali"},
    "8904093505159": {"name": "Patanjali Kesh Kanti",       "category": "shampoo",          "brand": "Patanjali"},
    # ── Mother Dairy ──
    "8906065941036": {"name": "Mother Dairy Milk",          "category": "milk",             "brand": "Mother Dairy"},
    # ── Dettol (Reckitt Benckiser India) ──
    "8901396009453": {"name": "Dettol Antiseptic Liquid",  "category": "sanitizer",        "brand": "Dettol"},
    "8901396035308": {"name": "Dettol Handwash",           "category": "shower_gel",       "brand": "Dettol"},
    "8901396060453": {"name": "Dettol Soap Bar",           "category": "soap_bar",         "brand": "Dettol"},
    "8901396315803": {"name": "Dettol Sanitizer 100ml",   "category": "sanitizer",        "brand": "Dettol"},
    "8901396315810": {"name": "Dettol Sanitizer 200ml",   "category": "sanitizer",        "brand": "Dettol"},
    "8901396315827": {"name": "Dettol Sanitizer 500ml",   "category": "sanitizer",        "brand": "Dettol"},
    "8901396118342": {"name": "Dettol Cool Soap",         "category": "soap_bar",         "brand": "Dettol"},
    "8901396042474": {"name": "Dettol Original Soap",     "category": "soap_bar",         "brand": "Dettol"},
    "8901396144150": {"name": "Dettol Re-Energize Soap",  "category": "soap_bar",         "brand": "Dettol"},
    # ── Global products ──
    "5449000054227": {"name": "Coca-Cola 330ml Can",        "category": "cola",             "brand": "Coca-Cola"},
    "5000112548167": {"name": "Pepsi 330ml Can",            "category": "cola",             "brand": "Pepsi"},
    "5000159484695": {"name": "Snickers Bar",               "category": "chocolate",        "brand": "Mars"},
    "4008400201634": {"name": "Haribo Goldbears",           "category": "cookies",          "brand": "Haribo"},
    "7613035349896": {"name": "Nescafe Classic",            "category": "coffee",           "brand": "Nescafe"},
    "4056489303084": {"name": "Aldi Coffee",                "category": "coffee",           "brand": "Aldi"},
    "3017624010701": {"name": "Nutella 200g",               "category": "chocolate",        "brand": "Ferrero"},
    "8000500310427": {"name": "Ferrero Rocher",             "category": "chocolate",        "brand": "Ferrero"},
    "5010663157513": {"name": "Walkers Crisps",             "category": "chips",            "brand": "Walkers"},
    "7622210449283": {"name": "Oreo Biscuit",               "category": "cookies",          "brand": "Oreo"},
    "5053990101066": {"name": "Pringles Original",          "category": "chips",            "brand": "Pringles"},
    "8718906394308": {"name": "AXE Deodorant",              "category": "deodorant",        "brand": "AXE"},
    "5012583202065": {"name": "Sure Deodorant",             "category": "deodorant",        "brand": "Sure"},
}

# ── MERGE EXTENDED PRODUCT DATABASES (1500+ additional products) ──────────
try:
    from products_db import PRODUCTS
    PREBUILT.update(PRODUCTS)
except ImportError:
    print("⚠️  products_db.py not found — using base database only")
try:
    from products_db2 import PRODUCTS_2
    PREBUILT.update(PRODUCTS_2)
except ImportError:
    print("⚠️  products_db2.py not found — using base database only")
try:
    from products_db3 import PRODUCTS_3
    PREBUILT.update(PRODUCTS_3)
except ImportError:
    print("⚠️  products_db3.py not found — using base database only")
try:
    from products_db4 import PRODUCTS_4
    PREBUILT.update(PRODUCTS_4)
except ImportError:
    print("⚠️  products_db4.py not found — using base database only")

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_cache(c):
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(c, f, indent=2)
    except Exception:
        pass

runtime_cache = load_cache()

def off_lookup(barcode):
    """Query Open Food Facts (no CORS from server side)."""
    fields = "product_name,brands,categories,ecoscore_grade,carbon_footprint_from_known_ingredients_100g,quantity"
    for base in [
        f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields={fields}",
        f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json",
    ]:
        try:
            r = requests.get(base, timeout=10, headers={"User-Agent": "EcoScanVIT/1.0"})
            if r.ok:
                j = r.json()
                if j.get("status") == 1:
                    p = j["product"]
                    return {
                        "source":     "openfoodfacts",
                        "name":       p.get("product_name", ""),
                        "brand":      (p.get("brands", "").split(",")[0]).strip(),
                        "categories": p.get("categories", ""),
                        "ecoscore":   p.get("ecoscore_grade", ""),
                        "co2_100g":   p.get("carbon_footprint_from_known_ingredients_100g"),
                        "quantity":   p.get("quantity", ""),
                    }
        except Exception:
            continue
    return None

def upc_lookup(barcode):
    """Query UPC Item DB."""
    try:
        r = requests.get(
            "https://api.upcitemdb.com/prod/trial/lookup",
            params={"upc": barcode}, timeout=8,
            headers={"User-Agent": "EcoScanVIT/1.0"}
        )
        if r.ok:
            j = r.json()
            if j.get("code") == "OK" and j.get("items"):
                item = j["items"][0]
                return {
                    "source":      "upcitemdb",
                    "name":        item.get("title", ""),
                    "brand":       item.get("brand", ""),
                    "categories":  item.get("category", ""),
                    "description": item.get("description", ""),
                }
    except Exception:
        pass
    return None

@app.route("/api/lookup/<barcode>")
def lookup(barcode):
    barcode = barcode.strip()

    # 1. Pre-built local database (instant)
    if barcode in PREBUILT:
        result = dict(PREBUILT[barcode])
        result["source"] = "local_db"
        return jsonify(result)

    # 2. Runtime cache (instant)
    if barcode in runtime_cache:
        result = dict(runtime_cache[barcode])
        result["source"] = "cache"
        return jsonify(result)

    # 3. Open Food Facts proxy (no CORS!)
    result = off_lookup(barcode)
    if result:
        runtime_cache[barcode] = result
        save_cache(runtime_cache)
        return jsonify(result)

    # 4. UPC Item DB proxy
    result = upc_lookup(barcode)
    if result:
        runtime_cache[barcode] = result
        save_cache(runtime_cache)
        return jsonify(result)

    # Not found
    return jsonify({"source": "not_found", "name": "", "categories": ""}), 404

@app.route("/api/ocr-barcode", methods=["POST"])
def ocr_barcode():
    """Accept a base64-encoded image, run OpenCV+EasyOCR+PyTesseract to read barcode digits."""
    data = request.get_json(silent=True)
    if not data or 'image' not in data:
        return jsonify({"error": "No image provided"}), 400

    try:
        # Decode base64 image
        img_b64 = data['image']
        # Strip data URL prefix if present
        if ',' in img_b64:
            img_b64 = img_b64.split(',', 1)[1]
        img_bytes = base64.b64decode(img_b64)
        img_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)

        if img_bgr is None:
            return jsonify({"error": "Could not decode image"}), 400

        code, method, conf_val, bbox_norm = ocr_read_barcode_number(img_bgr)

        if code:
            return jsonify({
                "barcode": code,
                "method":  method,
                "valid":   True if method and 'pyzbar' in method else validate_barcode(code),
                "indian":  code.startswith('890'),
                "conf":    round(float(conf_val or 0), 3),
                "bbox":    bbox_norm,
                "raw_texts": [code],
            })
        else:
            return jsonify({"barcode": None, "method": None, "valid": False,
                            "conf": 0, "bbox": None, "raw_texts": []}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health")
def health():
    return jsonify({
        "status":     "ok",
        "prebuilt":   len(PREBUILT),
        "cached":     len(runtime_cache),
    })

@app.route("/api/barcodes")
def list_barcodes():
    """Return all known barcode numbers for client-side fuzzy matching."""
    all_codes = list(PREBUILT.keys()) + list(runtime_cache.keys())
    return jsonify({"barcodes": all_codes})

if __name__ == "__main__":
    # Fix Windows terminal Unicode encoding
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    print("=" * 55)
    print("  [*] EcoScan Product Lookup Server")
    print("  Listening on http://localhost:5001")
    print(f"  Pre-built DB: {len(PREBUILT)} products")
    print("  Press Ctrl+C to stop")
    print("=" * 55)
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
