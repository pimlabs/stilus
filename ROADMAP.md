# Roadmap

Roadmap ini menjaga project tetap ringkas sekarang, tetapi punya jalur naik kelas yang jelas.

## V1 - Stable CLI Baseline

Status: done.

- CLI utama: `inspect`, `clean`, dan `compare`.
- Wrapper kompatibel: `build.py` dan `analyze.py`.
- Sample kecil: `data/example.md`.
- Data asli di `data/` tidak masuk Git.
- JSON report lewat `inspect --json`.
- Manifest otomatis saat `clean`.
- Test suite berbasis Python standard library.

## V1.1 - Polish

Fokus: membuat V1 lebih nyaman dipakai tanpa mengubah bentuk dasar.

- Perbaiki wording report agar lebih mudah dibaca.
- Tambah contoh workflow di README untuk naskah besar.
- Tambah dokumentasi exit code dan strict mode.
- Rapikan output test agar tidak terlalu berisik bila diperlukan.
- Tambah lebih banyak fixture kecil untuk edge case PDF extraction.

## V2 - Stronger Manuscript Engine

Fokus: kemampuan lebih kuat untuk naskah panjang dan format yang lebih beragam.

- Chunking per BAB/heading agar file besar lebih mudah diproses dan diaudit.
- Config/profile yang lebih fleksibel.
- Deteksi tabel lebih baik, termasuk kandidat tabel rusak.
- Report yang mengelompokkan warning per section/chapter.
- Compare yang lebih detail untuk heading, citations, dan table blocks.
- Mode resume untuk proses naskah besar jika dibutuhkan.

## V3 - Rewrite or Markdown-Aware Engine

Status: later.

V3 hanya layak dimulai jika V2 sudah membuktikan kebutuhan nyata.

Pilihan arah:

- TypeScript/Node jika fokusnya Markdown-aware pipeline, AST validation, dan ekosistem content tooling.
- Go jika fokusnya binary tunggal, performa streaming, dan distribusi CLI lintas platform.

Prinsip penting: command contract tetap stabil agar workflow dan skill agent tidak perlu berubah.
