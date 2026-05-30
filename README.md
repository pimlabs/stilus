# Manuscript QA & Cleanup CLI

CLI kecil untuk membersihkan, memvalidasi, membandingkan, dan membuat report dari manuskrip Markdown hasil ekstraksi PDF.

File naskah asli disimpan sebagai data lokal, misalnya `data/naskah.md` atau `data/naskah.pdf`. Isi `data/` diabaikan Git, kecuali `data/example.md` sebagai sample kecil.

## Commands

Inspect naskah:

```bash
python3 -m manuscript inspect data/naskah.md
```

Clean naskah:

```bash
python3 -m manuscript clean data/naskah.md -o dist/naskah-clean.md
```

Compare source dan hasil clean:

```bash
python3 -m manuscript compare data/naskah.md dist/naskah-clean.md
```

Buat JSON report dari inspect:

```bash
python3 -m manuscript inspect dist/naskah-clean.md --json dist/report.json
```

Coba sample bawaan:

```bash
python3 -m manuscript inspect --sample
python3 -m manuscript clean --sample
python3 -m manuscript compare data/example.md dist/example-clean.md
```

## Compatibility Wrappers

`build.py` dan `analyze.py` tetap tersedia sebagai wrapper sementara:

```bash
python3 build.py data/naskah.md -o dist/naskah-clean.md
python3 analyze.py data/naskah.md
```

Untuk sample:

```bash
python3 build.py --sample
python3 analyze.py --sample
```

## Quality Modes

Gunakan `--strict` untuk membuat command gagal dengan exit code `1` jika ditemukan masalah serius.

```bash
python3 -m manuscript inspect data/naskah.md --strict
python3 -m manuscript compare data/naskah.md dist/naskah-clean.md --strict
```

Severity yang digunakan:

- `ok` - tidak ada warning/error.
- `warning` - ada potensi masalah, tetapi command masih sukses.
- `error` - ada masalah serius; command keluar dengan exit code `1`.

## Profile

Profile default:

```bash
--profile indonesian-book
```

Profile ini mengenali pola umum buku Indonesia seperti `BAB`, `PROLOG`, `EPILOG`, `DAFTAR ISI`, dan `LAMPIRAN`.

## Output

Command `clean` menulis dua file:

- file Markdown hasil clean sesuai `--output`
- `dist/manifest.json` berisi input path, output path, timestamp, metrics before/after, warnings, errors, compare result, dan profile yang dipakai

Folder `dist/` dianggap output regeneratable dan tidak masuk Git.

## Tests

Jalankan test:

```bash
python3 -m unittest
```

Acceptance smoke test:

```bash
python3 -m manuscript inspect data/example.md
python3 -m manuscript clean data/example.md -o dist/example-clean.md
python3 -m manuscript compare data/example.md dist/example-clean.md
python3 -m manuscript inspect dist/example-clean.md --json dist/example-report.json
```

## Roadmap

See `ROADMAP.md` for the V1, V2, and V3 direction.
