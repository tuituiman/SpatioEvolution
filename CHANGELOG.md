# Changelog

All notable changes to **SpatioEvolution** are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — versioning follows [Semantic Versioning](https://semver.org/).

---

## [2.0.0] — 2026-06-27

### ✨ Added
- **Canvas Export** — Export map as PNG image or MP4 video with drag-and-drop widget layout (map, chart, title, legend, logo)
- **Timeline Animation** — Animate choropleth/bubble maps over time with play/pause/step controls
- **Map Label Callouts** — Display top-N or threshold-based labels on map features; labels filtered dynamically by current timeline frame
- **Bubble Map** — Proportional circle visualization on top of choropleth base
- **Heatmap Mode** — Kernel density estimation visualization for coordinate data
- **Coordinate Points Mode** — Plot raw GPS coordinates on map
- **Spatial Statistics** — Moran's I global/local spatial autocorrelation, DBSCAN clustering, SaTScan-like hotspot detection
- **Comparison Mode** — Side-by-side map comparison with synchronized timeline
- **EpiCurve** — Time-series bar chart synchronized with map timeline
- **Health Zone Scope** — Filter data by National, Regional, and Provincial health zones (12 เขตสุขภาพ)
- **PWA Support** — Installable as mobile/desktop app via `manifest.json`
- **Data Persistence** — IndexedDB-backed dataset storage with configurable retention days
- **Thai Encoding Repair** — Automatic Mojibake fix for legacy Excel/CSV files
- **Multi-sheet Excel** — Select specific sheet when importing `.xlsx` files
- **Bilingual UI** — Thai / English interface toggle

### 🔒 Security
- Content Security Policy (CSP) via `<meta>` tag
- `X-Content-Type-Options: nosniff` header
- `Referrer-Policy: strict-origin-when-cross-origin` header
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, USB
- `robots: noindex, nofollow` to prevent search engine indexing

### ⚙️ Infrastructure
- GitHub Actions CI/CD with two-job pipeline: `quality → build-and-deploy`
- Security audit (`npm audit --audit-level=high`) in CI
- ESLint + TypeScript type check in CI
- Unit test coverage report in CI
- Dependabot for automated dependency updates (npm weekly, GitHub Actions monthly)
- Manual chunk splitting: `react-vendor`, `leaflet-vendor`, `zustand-vendor`
- Web Workers for heavy computation: Excel ingestion, DBSCAN, Moran's I

### 🗺️ GeoData
- Province level: 77 จังหวัด
- District level: 928 อำเภอ
- Subdistrict level: 7,255 ตำบล (optional, ~12 MB)
- Thai name dictionary for location matching

---

## [1.0.0] — 2025 (Initial Release)

### Added
- Basic choropleth map visualization
- Excel/CSV data ingestion
- Province-level administrative boundaries

---

> **Note:** ข้อมูลทุกชุดประมวลผลในเครื่องของผู้ใช้เท่านั้น ไม่มีการส่งข้อมูลออกไปยัง server ใด ✅
