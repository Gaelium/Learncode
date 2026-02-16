// PDF Reader — client-side script for the webview
// pdfjsLib is set on window by the IIFE <script> tag loaded before this file.
// Config is passed via data- attributes on <body>.

(function () {
  try {
    var vscode = acquireVsCodeApi();
  } catch (err) {
    showFatalError('acquireVsCodeApi failed: ' + (err.message || err));
    return;
  }

  var pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    showFatalError('pdf.js library did not load. window.pdfjsLib is ' + typeof pdfjsLib);
    return;
  }

  if (typeof pdfjsLib.getDocument !== 'function') {
    showFatalError('pdf.js loaded but getDocument is missing. Keys: ' + Object.keys(pdfjsLib).join(', '));
    return;
  }

  var bodyData = document.body.dataset;
  var pdfUrl = bodyData.pdfUrl;
  var workerUrl = bodyData.workerUrl;
  var currentPage = parseInt(bodyData.initialPage, 10) || 1;

  var container = document.getElementById('pdf-container');
  var pageView = document.getElementById('page-view');
  var canvas = document.getElementById('pdf-canvas');
  var textLayerDiv = document.getElementById('text-layer');
  var pageInput = document.getElementById('pageInput');
  var pageCountEl = document.getElementById('pageCount');
  var pageInfoBottom = document.getElementById('pageInfoBottom');
  var ctx = canvas.getContext('2d');

  var pdfDoc = null;
  var rendering = false;
  var pendingPage = null;

  function showFatalError(msg) {
    var el = document.getElementById('pdf-container');
    if (el) {
      el.innerHTML = '<p style="padding:20px;color:var(--vscode-errorForeground);white-space:pre-wrap">'
        + msg + '</p>';
    }
  }

  function showError(msg) {
    document.getElementById('pdf-container').innerHTML =
      '<p style="padding:20px;color:var(--vscode-errorForeground)">' + msg + '</p>';
  }

  function getScale(page) {
    var unscaledViewport = page.getViewport({ scale: 1 });
    var availableWidth = container.clientWidth - 40; // padding
    if (availableWidth <= 0) availableWidth = 600;
    return availableWidth / unscaledViewport.width;
  }

  async function init() {
    try {
      // Set up worker via blob URL to avoid CSP issues
      var workerResponse = await fetch(workerUrl);
      var workerBlob = await workerResponse.blob();
      var workerBlobUrl = URL.createObjectURL(workerBlob);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
    } catch (err) {
      showFatalError('Worker setup failed: ' + (err.message || err));
      return;
    }

    try {
      var pdfResponse = await fetch(pdfUrl);
      var pdfData = await pdfResponse.arrayBuffer();

      pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;

      if (pageCountEl) pageCountEl.textContent = String(pdfDoc.numPages);
      if (pageInput) pageInput.max = String(pdfDoc.numPages);

      await renderPage(currentPage);
    } catch (err) {
      showError('Failed to load PDF: ' + (err.message || err));
    }
  }

  async function renderPage(num) {
    if (rendering) {
      pendingPage = num;
      return;
    }
    rendering = true;
    currentPage = num;

    try {
      var page = await pdfDoc.getPage(num);
      var scale = getScale(page);
      var viewport = page.getViewport({ scale: scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pageView.style.width = viewport.width + 'px';
      pageView.style.height = viewport.height + 'px';

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Set --total-scale-factor so pdfjs TextLayer can compute dimensions
      container.style.setProperty('--total-scale-factor', String(scale));
      container.style.setProperty('--scale-round-x', '1px');
      container.style.setProperty('--scale-round-y', '1px');

      // Render text layer for selection
      textLayerDiv.innerHTML = '';

      try {
        var textContent = await page.getTextContent();
        if (typeof pdfjsLib.TextLayer === 'function') {
          var textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });
          await textLayer.render();
        } else if (typeof pdfjsLib.renderTextLayer === 'function') {
          textLayerDiv.style.width = viewport.width + 'px';
          textLayerDiv.style.height = viewport.height + 'px';
          pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });
        }
      } catch (textErr) {
        // Text layer is non-critical — continue without it
        console.warn('Text layer error:', textErr);
      }

      // Update UI
      if (pageInput) pageInput.value = String(num);
      if (pageInfoBottom) pageInfoBottom.textContent = num + ' / ' + pdfDoc.numPages;

      updateNavButtons();
      vscode.postMessage({ command: 'pageRendered', page: num });
    } catch (err) {
      console.error('Error rendering page', num, err);
      showError('Error rendering page ' + num + ': ' + (err.message || err));
    }

    rendering = false;
    if (pendingPage !== null) {
      var p = pendingPage;
      pendingPage = null;
      await renderPage(p);
    }
  }

  function updateNavButtons() {
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var prevBtnBottom = document.getElementById('prevBtnBottom');
    var nextBtnBottom = document.getElementById('nextBtnBottom');

    var hasPrev = currentPage > 1;
    var hasNext = pdfDoc && currentPage < pdfDoc.numPages;

    if (prevBtn) prevBtn.disabled = !hasPrev;
    if (nextBtn) nextBtn.disabled = !hasNext;
    if (prevBtnBottom) prevBtnBottom.disabled = !hasPrev;
    if (nextBtnBottom) nextBtnBottom.disabled = !hasNext;
  }

  function navigate(direction) {
    var newPage = currentPage + direction;
    if (pdfDoc && newPage >= 1 && newPage <= pdfDoc.numPages) {
      renderPage(newPage);
    }
  }

  // Navigation buttons
  document.getElementById('prevBtn').addEventListener('click', function () { navigate(-1); });
  document.getElementById('nextBtn').addEventListener('click', function () { navigate(1); });
  document.getElementById('prevBtnBottom').addEventListener('click', function () { navigate(-1); });
  document.getElementById('nextBtnBottom').addEventListener('click', function () { navigate(1); });

  // Page number input
  if (pageInput) {
    pageInput.addEventListener('change', function () {
      var num = parseInt(pageInput.value, 10);
      if (pdfDoc && num >= 1 && num <= pdfDoc.numPages) {
        renderPage(num);
      }
    });
    pageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        pageInput.blur();
      }
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', function (e) {
    if (document.activeElement === pageInput) return;

    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      navigate(1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      renderPage(1);
    } else if (e.key === 'End' && pdfDoc) {
      e.preventDefault();
      renderPage(pdfDoc.numPages);
    }
  });

  // Listen for messages from the extension
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (message.command === 'navigateToPage') {
      renderPage(message.page);
    }
  });

  // Start
  init();

})();
