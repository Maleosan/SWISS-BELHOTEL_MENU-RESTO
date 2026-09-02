# Swiss-Belhotel Menu Resto

Flipbook menu digital responsif untuk Swiss-Belhotel Maleosan Manado.

## Fitur

- Flipbook responsif untuk desktop dan ponsel
- Lazy rendering untuk menghemat memori
- Navigasi halaman, thumbnail, zoom, dan keyboard
- Pencarian teks PDF
- Fullscreen, unduh, cetak, dan berbagi
- Tema gelap/terang, loading progress, dan error state
- Aksesibilitas dan reduced motion

## Menjalankan

`npm install`, lalu `npm run dev`. Untuk produksi gunakan `npm run check && npm run build`.

Folder root juga menyimpan hasil build agar kompatibel dengan GitHub Pages yang menggunakan sumber `main / (root)`. Jangan mengedit file hasil build secara manual; ubah file di `src`, lalu jalankan build.

## Mengganti menu

Ganti `public/buku.pdf` dengan PDF baru bernama sama, lalu build dan commit.
