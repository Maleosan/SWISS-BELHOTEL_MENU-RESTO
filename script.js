// Configuration
const CONFIG = {
  PDF_URL: './buku.pdf',
  ZOOM_STEP: 0.1,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2.5,
  INITIAL_ZOOM: 1,
  DEBOUNCE_DELAY: 150,
};

// State
let state = {
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  zoom: CONFIG.INITIAL_ZOOM,
  isLoading: false,
  showCover: true,
  containerWidth: 0,
  containerHeight: 0,
};

// DOM Elements
const elements = {
  app: document.getElementById('app'),
  coverMenu: document.getElementById('cover-menu'),
  flipbookWrapper: document.getElementById('flipbook-wrapper'),
  book: document.getElementById('book'),
  bookContainer: document.getElementById('book-container'),
  openMenuBtn: document.getElementById('open-menu-btn'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomLevel: document.getElementById('zoom-level'),
  currentPageSpan: document.getElementById('current-page'),
  totalPagesSpan: document.getElementById('total-pages'),
};

// Utility: Debounce function
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Initialize PDF.js
async function initPDF() {
  try {
    state.isLoading = true;
    const response = await fetch(CONFIG.PDF_URL);
    const arrayBuffer = await response.arrayBuffer();
    state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    state.totalPages = state.pdfDoc.numPages;
    elements.totalPagesSpan.textContent = state.totalPages;
    await renderPage(state.currentPage);
    updateNavigationButtons();
  } catch (error) {
    console.error('Error loading PDF:', error);
    elements.book.innerHTML = '<p style="color: #ff6b6b; font-size: 18px; padding: 20px;">Error loading PDF file</p>';
  } finally {
    state.isLoading = false;
  }
}

// Render PDF page
async function renderPage(pageNum) {
  if (state.isLoading || !state.pdfDoc) return;

  if (pageNum < 1 || pageNum > state.totalPages) return;

  state.isLoading = true;

  try {
    const page = await state.pdfDoc.getPage(pageNum);

    // Calculate optimal size for responsive display
    const viewport = page.getViewport({ scale: 1 });
    const { width: containerWidth, height: containerHeight } = getContainerDimensions();

    // Calculate scale to fit container while maintaining aspect ratio
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    const optimalScale = Math.min(scaleX, scaleY, 2); // Cap at 2x for quality

    // Apply zoom multiplier
    const scale = optimalScale * state.zoom;

    // Get viewport with calculated scale
    const scaledViewport = page.getViewport({ scale });

    // Create or reuse canvas
    let canvas = elements.book.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      elements.book.innerHTML = '';
      elements.book.appendChild(canvas);
    }

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Render page to canvas
    const context = canvas.getContext('2d');
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    };

    await page.render(renderContext).promise;

    // Update state and UI
    state.currentPage = pageNum;
    elements.currentPageSpan.textContent = state.currentPage;
    updateNavigationButtons();

    // Center the PDF in container
    centerPdfInContainer();
  } catch (error) {
    console.error('Error rendering page:', error);
  } finally {
    state.isLoading = false;
  }
}

// Get container dimensions
function getContainerDimensions() {
  const rect = elements.bookContainer.getBoundingClientRect();
  return {
    width: rect.width * 0.95, // Leave 5% margin
    height: rect.height * 0.95, // Leave 5% margin
  };
}

// Center PDF in container
function centerPdfInContainer() {
  const canvas = elements.book.querySelector('canvas');
  if (!canvas) return;

  // Reset transform
  elements.book.style.transform = 'translate(0, 0)';

  const containerRect = elements.bookContainer.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  const offsetX = (containerRect.width - canvasRect.width) / 2;
  const offsetY = (containerRect.height - canvasRect.height) / 2;

  // Ensure PDF doesn't overflow
  if (canvasRect.width > containerRect.width) {
    elements.book.style.transform = `translateX(${Math.min(0, offsetX)}px)`;
  } else {
    elements.book.style.transform = `translateX(${offsetX}px)`;
  }
}

// Update navigation buttons state
function updateNavigationButtons() {
  elements.prevBtn.disabled = state.currentPage <= 1;
  elements.nextBtn.disabled = state.currentPage >= state.totalPages;
}

// Update zoom buttons state
function updateZoomButtons() {
  elements.zoomOutBtn.disabled = state.zoom <= CONFIG.MIN_ZOOM;
  elements.zoomInBtn.disabled = state.zoom >= CONFIG.MAX_ZOOM;
  elements.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
}

// Zoom functions
function zoomIn() {
  if (state.zoom < CONFIG.MAX_ZOOM) {
    state.zoom = Math.min(state.zoom + CONFIG.ZOOM_STEP, CONFIG.MAX_ZOOM);
    updateZoomButtons();
    renderPage(state.currentPage);
  }
}

function zoomOut() {
  if (state.zoom > CONFIG.MIN_ZOOM) {
    state.zoom = Math.max(state.zoom - CONFIG.ZOOM_STEP, CONFIG.MIN_ZOOM);
    updateZoomButtons();
    renderPage(state.currentPage);
  }
}

// Navigation functions
function goToPreviousPage() {
  if (state.currentPage > 1) {
    renderPage(state.currentPage - 1);
  }
}

function goToNextPage() {
  if (state.currentPage < state.totalPages) {
    renderPage(state.currentPage + 1);
  }
}

// Handle orientation and resize
const debouncedHandleResize = debounce(() => {
  if (state.pdfDoc) {
    // Reset zoom to initial value on resize
    state.zoom = CONFIG.INITIAL_ZOOM;
    updateZoomButtons();
    renderPage(state.currentPage);
  }
}, CONFIG.DEBOUNCE_DELAY);

// Setup Resize Observer for responsive behavior
function setupResizeObserver() {
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => {
      debouncedHandleResize();
    });
    resizeObserver.observe(elements.bookContainer);
  } else {
    // Fallback for browsers without ResizeObserver
    window.addEventListener('resize', debouncedHandleResize);
    window.addEventListener('orientationchange', debouncedHandleResize);
  }
}

// Handle orientation change
function handleOrientationChange() {
  // Wait for layout to complete
  setTimeout(() => {
    debouncedHandleResize();
  }, 100);
}

// Open flipbook from cover
function openFlipbook() {
  state.showCover = false;
  elements.coverMenu.classList.add('hidden');
  elements.flipbookWrapper.classList.remove('hidden');

  // Ensure proper rendering after transition
  setTimeout(() => {
    if (state.pdfDoc) {
      renderPage(state.currentPage);
    }
  }, 300);
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only handle if flipbook is visible
    if (elements.flipbookWrapper.classList.contains('hidden')) return;

    switch (e.key) {
      case 'ArrowLeft':
        goToPreviousPage();
        e.preventDefault();
        break;
      case 'ArrowRight':
        goToNextPage();
        e.preventDefault();
        break;
      case '+':
      case '=':
        zoomIn();
        e.preventDefault();
        break;
      case '-':
      case '_':
        zoomOut();
        e.preventDefault();
        break;
    }
  });
}

// Initialize event listeners
function setupEventListeners() {
  // Cover menu
  elements.openMenuBtn.addEventListener('click', openFlipbook);

  // Navigation
  elements.prevBtn.addEventListener('click', goToPreviousPage);
  elements.nextBtn.addEventListener('click', goToNextPage);

  // Zoom
  elements.zoomInBtn.addEventListener('click', zoomIn);
  elements.zoomOutBtn.addEventListener('click', zoomOut);

  // Orientation and resize
  window.addEventListener('orientationchange', handleOrientationChange);
  setupResizeObserver();

  // Keyboard shortcuts
  setupKeyboardShortcuts();

  // Touch swipe support
  setupSwipeNavigation();
}

// Swipe navigation for touch devices
function setupSwipeNavigation() {
  let touchStartX = 0;
  let touchEndX = 0;

  elements.bookContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, false);

  elements.bookContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left - next page
        goToNextPage();
      } else {
        // Swiped right - previous page
        goToPreviousPage();
      }
    }
  }
}

// Main initialization
async function init() {
  try {
    await initPDF();
    setupEventListeners();
    updateZoomButtons();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Start application
document.addEventListener('DOMContentLoaded', init);

// Handle window load for additional setup
window.addEventListener('load', () => {
  // Ensure proper sizing after all resources loaded
  if (state.pdfDoc && !state.showCover) {
    debouncedHandleResize();
  }
});
