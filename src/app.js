import { PageFlip } from "page-flip";
import * as pdfjs from "pdfjs-dist";
import "./styles.css";
pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";
const $ = (s) => document.querySelector(s),
  $$ = (s) => document.querySelectorAll(s);
$("#app").innerHTML =
  `<main class="viewer"><header><div class="brand"><b>SB</b><span><strong>Swiss-Belhotel Maleosan</strong><small>Menu Restaurant</small></span></div><nav><button data-do="search" title="Cari" aria-label="Cari">⌕</button><button data-do="thumbs" title="Halaman" aria-label="Daftar halaman">▦</button><button data-do="theme" title="Tema" aria-label="Ganti tema">◐</button><button data-do="full" title="Layar penuh" aria-label="Layar penuh">⛶</button><button data-do="more" aria-label="Menu lain">•••</button><div class="menu"><button data-do="share">Bagikan</button><a href="./buku.pdf" download>Unduh PDF</a><button data-do="print">Cetak</button></div></nav></header><aside class="search" hidden><div><strong>Cari dalam menu</strong><button data-do="close">×</button></div><form><input type="search" placeholder="Nama makanan atau minuman" aria-label="Kata pencarian"><button>Cari</button></form><p class="status"></p><section class="results"></section></aside><aside class="thumbs" hidden><div><strong>Semua halaman</strong><button data-do="close">×</button></div><section></section></aside><section class="stage"><button class="arrow prev" data-do="prev" aria-label="Sebelumnya">‹</button><div id="book"></div><button class="cover-open" data-do="open" hidden>Buka Menu <span>→</span></button><button class="arrow next" data-do="next" aria-label="Berikutnya">›</button><div class="loading"><i>SB</i><strong>Menyiapkan menu</strong><progress max="100" value="10"></progress><small>Mengunduh dokumen…</small></div><div class="error" hidden><strong>Menu belum dapat dimuat</strong><span>Periksa koneksi lalu coba kembali.</span><button data-do="reload">Muat ulang</button></div></section><footer><div><button data-do="prev">‹</button><input id="page" inputmode="numeric" value="1" aria-label="Nomor halaman"><span>/ <b id="count">–</b></span><button data-do="next">›</button></div><div class="zoom"><button data-do="out">−</button><input id="range" type="range" min="70" max="140" value="100" aria-label="Zoom"><button data-do="in">+</button><output>100%</output></div><small>Gunakan ← → untuk berpindah halaman</small></footer><div class="toast" role="status"></div></main>`;
let pdf,
  flip,
  pages = [],
  zoom = 1;
const done = new Set(),
  busy = new Map();
function progress(n, text) {
  $("progress").value = n;
  $(".loading small").textContent = text;
}
function trimWhiteBorders(canvas) {
  const context = canvas.getContext("2d", { alpha: false });
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = 0,
    bottom = 0;
  const step = 3;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      if (pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right <= left || bottom <= top) return;
  const pad = Math.max(3, Math.round(Math.min(width, height) * 0.006));
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width, right + pad);
  bottom = Math.min(height, bottom + pad);
  const croppedWidth = right - left;
  const croppedHeight = bottom - top;
  if (croppedWidth < width * 0.3 || croppedHeight < height * 0.3) return;
  const copy = document.createElement("canvas");
  copy.width = croppedWidth;
  copy.height = croppedHeight;
  copy.getContext("2d", { alpha: false }).drawImage(
    canvas,
    left,
    top,
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight,
  );
  canvas.width = croppedWidth;
  canvas.height = croppedHeight;
  canvas.getContext("2d", { alpha: false }).drawImage(copy, 0, 0);
}
async function render(index, type = "page") {
  const key = type + index;
  if (!pdf || index < 0 || index >= pdf.numPages || done.has(key)) return;
  if (busy.has(key)) return busy.get(key);
  const job = (async () => {
    const page = await pdf.getPage(index + 1),
      target =
        type === "thumb"
          ? document.querySelector(`[data-thumb="${index}"] canvas`)
          : pages[index]?.querySelector("canvas");
    if (!target) return;
    const base = page.getViewport({ scale: 1 }),
      scale =
        type === "thumb"
          ? Math.min(0.25, 150 / base.width)
          : Math.min(1.5, devicePixelRatio || 1),
      view = page.getViewport({ scale });
    target.width = view.width;
    target.height = view.height;
    await page.render({
      canvasContext: target.getContext("2d", { alpha: false }),
      viewport: view,
    }).promise;
    trimWhiteBorders(target);
    done.add(key);
  })().finally(() => busy.delete(key));
  busy.set(key, job);
  return job;
}
function nearby(i) {
  [i - 2, i - 1, i, i + 1, i + 2].forEach((x) => render(x));
}
function sync(i) {
  $("#page").value = i + 1;
  $$('[data-do="prev"]').forEach((b) => (b.disabled = i <= 0));
  $$('[data-do="next"]').forEach((b) => (b.disabled = i >= pdf.numPages - 1));
  $(".cover-open").hidden = !(i === 0 && matchMedia("(orientation: landscape)").matches);
  $$("[data-thumb]").forEach((b) =>
    b.classList.toggle("active", +b.dataset.thumb === i),
  );
  nearby(i);
}
async function init() {
  try {
    pdf = await pdfjs.getDocument({
      url: new URL("./buku.pdf", location.href).href,
    }).promise;
    $("#count").textContent = pdf.numPages;
    $("#page").max = pdf.numPages;
    progress(35, `${pdf.numPages} halaman ditemukan`);
    const first = await pdf.getPage(1),
      v = first.getViewport({ scale: 1 });
    document.documentElement.style.setProperty("--page-ratio", v.width / v.height);
    pages = Array.from({ length: pdf.numPages }, (_, i) => {
      const p = document.createElement("div");
      p.className = "page";
      p.dataset.density = i === 0 || i === pdf.numPages - 1 ? "hard" : "soft";
      p.innerHTML = `<canvas aria-label="Halaman ${i + 1}"></canvas><em>Memuat ${i + 1}</em>`;
      $("#book").append(p);
      return p;
    });
    progress(60, "Menyiapkan halaman pertama…");
    await Promise.all([render(0), render(1)]);
    flip = new PageFlip($("#book"), {
      width: v.width,
      height: v.height,
      size: "stretch",
      minWidth: 140,
      maxWidth: v.width,
      minHeight: 200,
      maxHeight: v.height,
      maxShadowOpacity: 0.3,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: true,
      flippingTime: 450,
      swipeDistance: 10,
      autoSize: true,
    });
    flip.loadFromHTML(pages);
    flip.on("flip", (e) => sync(e.data));
    flip.on("changeOrientation", () => {
      nearby(flip.getCurrentPageIndex());
      sync(flip.getCurrentPageIndex());
    });
    $(".thumbs section").innerHTML = pages
      .map(
        (_, i) =>
          `<button data-thumb="${i}"><canvas></canvas><span>${i + 1}</span></button>`,
      )
      .join("");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach(
          (e) => e.isIntersecting && render(+e.target.dataset.thumb, "thumb"),
        ),
      { root: $(".thumbs section"), rootMargin: "150px" },
    );
    $$("[data-thumb]").forEach((x) => io.observe(x));
    sync(0);
    progress(100, "Menu siap");
    setTimeout(() => $(".loading").classList.add("hide"), 250);
  } catch (e) {
    console.error(e);
    $(".loading").hidden = true;
    $(".error").hidden = false;
  }
}
function go(n) {
  if (flip) flip.flip(Math.max(0, Math.min(pdf.numPages - 1, (+n || 1) - 1)));
}
function setZoom(n) {
  zoom = Math.max(0.7, Math.min(1.4, n));
  $("#range").value = zoom * 100;
  $("output").value = Math.round(zoom * 100) + "%";
  $("#book").style.setProperty("--zoom", zoom);
}
function toast(t) {
  $(".toast").textContent = t;
  $(".toast").classList.add("show");
  setTimeout(() => $(".toast").classList.remove("show"), 2200);
}
async function search(q) {
  q = q.trim().toLocaleLowerCase("id");
  if (q.length < 2) return toast("Masukkan minimal 2 huruf");
  const hits = [];
  $(".results").innerHTML = "";
  for (let i = 0; i < pdf.numPages; i++) {
    const p = await pdf.getPage(i + 1),
      text = (await p.getTextContent()).items.map((x) => x.str).join(" ");
    if (text.toLocaleLowerCase("id").includes(q)) hits.push({ i, text });
    $(".status").textContent =
      `Memeriksa ${i + 1} dari ${pdf.numPages} halaman…`;
  }
  $(".status").textContent = hits.length
    ? `${hits.length} halaman ditemukan`
    : "Tidak ada hasil";
  $(".results").innerHTML = hits
    .map(
      (x) =>
        `<button data-page="${x.i + 1}"><b>Halaman ${x.i + 1}</b><span>${x.text.slice(0, 100)}${x.text.length > 100 ? "…" : ""}</span></button>`,
    )
    .join("");
}
document.addEventListener("click", async (e) => {
  const jump = e.target.closest("[data-page],[data-thumb]");
  if (jump) {
    go(jump.dataset.page || +jump.dataset.thumb + 1);
    $(".thumbs").hidden = true;
  }
  const b = e.target.closest("[data-do]");
  if (!b) return;
  const a = b.dataset.do;
  if (a === "prev") flip?.flipPrev();
  if (a === "next") flip?.flipNext();
  if (a === "open") flip?.flipNext();
  if (a === "out") setZoom(zoom - 0.1);
  if (a === "in") setZoom(zoom + 0.1);
  if (a === "reload") location.reload();
  if (a === "thumbs") $(".thumbs").hidden = !$(".thumbs").hidden;
  if (a === "search") {
    $(".search").hidden = !$(".search").hidden;
    $(".search input").focus();
  }
  if (a === "close") {
    b.closest("aside").hidden = true;
  }
  if (a === "theme") document.documentElement.classList.toggle("light");
  if (a === "full")
    document.fullscreenElement
      ? document.exitFullscreen()
      : $(".viewer").requestFullscreen();
  if (a === "more") $(".menu").classList.toggle("open");
  if (a === "print") window.open("./buku.pdf", "_blank", "noopener");
  if (a === "share")
    try {
      navigator.share
        ? await navigator.share({ title: document.title, url: location.href })
        : (await navigator.clipboard.writeText(location.href),
          toast("Tautan disalin"));
    } catch (err) {
      if (err.name !== "AbortError") toast("Belum dapat dibagikan");
    }
});
$(".search form").addEventListener("submit", (e) => {
  e.preventDefault();
  search($(".search input").value);
});
$("#page").addEventListener("change", (e) => go(e.target.value));
$("#range").addEventListener("input", (e) => setZoom(+e.target.value / 100));
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input")) return;
  if (e.key === "ArrowLeft") flip?.flipPrev();
  if (e.key === "ArrowRight" || e.key === " ") {
    flip?.flipNext();
    e.preventDefault();
  }
  if (e.key === "+") setZoom(zoom + 0.1);
  if (e.key === "-") setZoom(zoom - 0.1);
});
matchMedia("(orientation: landscape)").addEventListener("change", () => {
  if (flip) sync(flip.getCurrentPageIndex());
});
init();
