# EcoScan VIT 🌿

A campus carbon footprint tracker for VIT Vellore. Students scan product barcodes via their web browser to instantly see the CO₂ lifecycle data of what they buy — and compete on a real-time leaderboard to become the most eco-conscious on campus.

---

## Features

- **Barcode Scanner** — Multi-method scanning via Native BarcodeDetector, ZXing WASM, and Tesseract.js OCR with EAN-13/UPC-A checksum validation
- **Carbon Intelligence** — 60+ product categories with full 5-stage LCA data (Raw Materials → Manufacturing → Shipping → Usage → End-of-Life), sourced from IPCC, ecoinvent, and Quantis studies
- **Point System & Leaderboard** — Each scan earns points; top eco-conscious students are ranked live on the campus dashboard
- **1500+ Product Database** — Prebuilt Indian and global barcode database with instant lookups; falls back to Open Food Facts and UPC Item DB APIs
- **Campus Dashboard** — Real-time analytics: total CO₂, department breakdown, category donut chart, live scan feed, and leaderboard
- **VIT Auth** — Google Sign-In restricted to `@vitstudent.ac.in` domain only

---

## Point System

Every time a student scans a product, their activity is recorded to Firebase Firestore:

| Action | What Gets Tracked |
|---|---|
| Scan a product | +1 to `totalScans` |
| Product CO₂ logged | CO₂ value added to `totalCO2` |

Each scan document stored in `scans` collection includes:

```
uid, studentId, productName, category, co2, rating, barcode, method, timestamp
```

### Carbon Rating (Grade)

Products are rated A–D based on their lifecycle CO₂:

| Grade | Meaning |
|---|---|
| **A** | Low carbon footprint — excellent choice |
| **B** | Moderate footprint — acceptable |
| **C** | High footprint — consider alternatives |
| **D** | Very high footprint — significant impact |

The scan page shows 3 greener alternative products with estimated % CO₂ savings.

---

## Leaderboard

The **Eco-Conscious Leaderboard** on the dashboard ranks the top 10 students campus-wide, sorted by total number of scans. It is powered by a live Firestore query:

```
students collection → orderBy('totalScans', 'desc') → limit(10)
```

Each entry shows:
- 🥇 🥈 🥉 medal or rank number
- Student name and department
- Total CO₂ tracked (kg)
- Total scans count

The leaderboard updates every time the dashboard loads.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask 3.0+, Gunicorn |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google Sign-In) |
| Barcode Reading | Native BarcodeDetector, ZXing WASM, Tesseract.js |
| External APIs | Open Food Facts, UPC Item DB |
| Hosting | Render (render.yaml configured) |

---

## Project Structure

```
HEK/
├── server.py           # Flask backend — barcode lookup API + file serving
├── products_db.py      # Prebuilt barcode → product database (part 1)
├── products_db2.py     # Prebuilt barcode → product database (part 2)
├── products_db3.py     # Prebuilt barcode → product database (part 3)
├── products_db4.py     # Prebuilt barcode → product database (part 4)
├── ecoscan_logic.js    # Scanner logic — barcode reading, carbon calc, Firebase
├── ecoscan.html        # Barcode scanner UI
├── dashboard.html      # Campus analytics dashboard + leaderboard
├── index.html          # Landing page
├── login.html          # Google auth page (VIT domain only)
├── firebase-config.js  # Firebase project config + allowed domain
├── barcodes_cache.json # Runtime barcode lookup cache
├── requirements.txt    # Python dependencies
└── render.yaml         # Render.com deployment config
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Landing page |
| `GET` | `/login` | Login page |
| `GET` | `/scan` | Barcode scanner |
| `GET` | `/dashboard` | Campus dashboard |
| `GET` | `/api/lookup/<barcode>` | Product + CO₂ lookup |
| `GET` | `/api/health` | Server status and DB counts |
| `GET` | `/api/barcodes` | List all known barcodes |

### Barcode Lookup Chain

1. **PREBUILT dict** — 1500+ products, instant (no network)
2. **Runtime cache** — Previously fetched results
3. **Open Food Facts API** — Global food product database
4. **UPC Item DB** — UPC code fallback

---

## Firestore Data Model

```
scans/                    # All scan events
  └── {docId}
        uid, studentId, productName, category,
        co2, rating, barcode, method, timestamp

students/                 # Per-student aggregates (used for leaderboard)
  └── {uid}
        name, email, regId, dept,
        totalScans, totalCO2, joinedAt

stats/
  └── global              # Campus-wide totals
        totalScans, totalCo2, catBreakdown, lastUpdated
```

---

## Setup & Running Locally

### Prerequisites
- Python 3.10+
- A Firebase project with Firestore + Authentication enabled

### Install dependencies

```bash
pip install -r requirements.txt
```

### Configure Firebase

Edit `firebase-config.js` with your Firebase project credentials:

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ...
};
const ALLOWED_DOMAIN = "vitstudent.ac.in";
```

### Run the server

```bash
python server.py
```

Server starts on `http://localhost:5001`.

---

## Deployment (Render)

The `render.yaml` file configures automatic deployment on [Render](https://render.com):

```bash
# Start command
gunicorn server:app
```

Set the `PORT` environment variable on Render if needed (defaults to 5001 locally).

---

## Carbon Data Sources

- **IPCC AR6** — Lifecycle emission factors
- **ecoinvent 3.9** — Process-level LCA data  
- **Quantis** — Food and consumer goods studies
- **Open Food Facts** — Real product ecoscore data (live API)

---

## License

For academic and educational use at VIT Vellore.
