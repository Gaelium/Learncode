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
  var highlightLayer = document.getElementById('highlight-layer');
  var textLayerDiv = document.getElementById('text-layer');
  var pageInput = document.getElementById('pageInput');
  var pageCountEl = document.getElementById('pageCount');
  var pageInfoBottom = document.getElementById('pageInfoBottom');
  var ctx = canvas.getContext('2d');

  var pdfDoc = null;
  var rendering = false;
  var pendingPage = null;
  var currentAnnotations = [];

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

  // --- Annotation: floating button ---

  var annotateBtn = document.createElement('button');
  annotateBtn.id = 'annotateBtn';
  annotateBtn.textContent = 'Add Note';
  annotateBtn.style.display = 'none';
  document.body.appendChild(annotateBtn);

  var tooltip = document.createElement('div');
  tooltip.className = 'annotation-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  var annotationPopup = document.createElement('div');
  annotationPopup.className = 'annotation-popup';
  annotationPopup.style.display = 'none';
  document.body.appendChild(annotationPopup);

  function getTextContext(fullText, selText, charsBefore, charsAfter) {
    var idx = fullText.indexOf(selText);
    if (idx < 0) return { prefix: '', suffix: '' };
    var prefix = fullText.substring(Math.max(0, idx - charsBefore), idx);
    var suffix = fullText.substring(idx + selText.length, idx + selText.length + charsAfter);
    return { prefix: prefix, suffix: suffix };
  }

  textLayerDiv.addEventListener('mouseup', function (e) {
    var sel = window.getSelection();
    var selText = sel ? sel.toString().trim() : '';
    if (!selText) {
      annotateBtn.style.display = 'none';
      return;
    }

    // Position button near mouse
    annotateBtn.style.left = e.pageX + 'px';
    annotateBtn.style.top = (e.pageY - 35) + 'px';
    annotateBtn.style.display = 'block';
  });

  annotateBtn.addEventListener('mousedown', function (e) {
    e.preventDefault(); // keep selection alive
  });

  annotateBtn.addEventListener('click', function () {
    var sel = window.getSelection();
    var selText = sel ? sel.toString().trim() : '';
    if (!selText) {
      annotateBtn.style.display = 'none';
      return;
    }

    var fullText = textLayerDiv.textContent || '';
    var ctx = getTextContext(fullText, selText, 30, 30);

    vscode.postMessage({
      command: 'addAnnotation',
      selectedText: selText,
      textPrefix: ctx.prefix,
      textSuffix: ctx.suffix,
      pageOrSpineIndex: currentPage,
    });

    annotateBtn.style.display = 'none';
    sel.removeAllRanges();
  });

  // Hide button/popup on click elsewhere
  document.addEventListener('mousedown', function (e) {
    if (e.target !== annotateBtn && !annotateBtn.contains(e.target)) {
      annotateBtn.style.display = 'none';
    }
    if (!annotationPopup.contains(e.target) &&
        !(e.target.classList && e.target.classList.contains('learncode-highlight'))) {
      annotationPopup.style.display = 'none';
    }
  });

  // --- Annotation: highlight rendering ---

  function applyAnnotations(annotations) {
    currentAnnotations = annotations || [];

    // Clear existing highlights from text layer spans
    var highlighted = textLayerDiv.querySelectorAll('.learncode-highlight');
    for (var h = 0; h < highlighted.length; h++) {
      highlighted[h].classList.remove('learncode-highlight');
      highlighted[h].removeAttribute('data-note');
      highlighted[h].removeAttribute('data-annotation-id');
    }

    // Clear overlay rects
    highlightLayer.innerHTML = '';

    if (!currentAnnotations.length) return;

    var spans = textLayerDiv.querySelectorAll('span');
    if (!spans.length) return;

    // Build concatenated text with span boundary info
    var entries = [];
    var fullText = '';
    for (var i = 0; i < spans.length; i++) {
      var spanText = spans[i].textContent || '';
      entries.push({ span: spans[i], start: fullText.length, end: fullText.length + spanText.length });
      fullText += spanText;
    }

    var pageViewRect = pageView.getBoundingClientRect();

    for (var a = 0; a < currentAnnotations.length; a++) {
      var ann = currentAnnotations[a];
      var idx = findAnnotationIndex(fullText, ann);
      if (idx < 0) continue;

      var endIdx = idx + ann.selectedText.length;
      for (var s = 0; s < entries.length; s++) {
        var e = entries[s];
        if (e.end > idx && e.start < endIdx) {
          // Tag the text layer span for hover/click interaction
          e.span.classList.add('learncode-highlight');
          e.span.setAttribute('data-note', ann.note || '');
          e.span.setAttribute('data-annotation-id', ann.id);

          // Create a visible rect in the overlay layer
          var spanRect = e.span.getBoundingClientRect();
          var rect = document.createElement('div');
          rect.className = 'learncode-highlight-rect';
          rect.style.left = (spanRect.left - pageViewRect.left) + 'px';
          rect.style.top = (spanRect.top - pageViewRect.top) + 'px';
          rect.style.width = spanRect.width + 'px';
          rect.style.height = spanRect.height + 'px';
          highlightLayer.appendChild(rect);
        }
      }
    }
  }

  function findAnnotationIndex(fullText, ann) {
    var idx = fullText.indexOf(ann.selectedText);
    if (idx >= 0 && ann.textPrefix) {
      var before = fullText.substring(Math.max(0, idx - 40), idx);
      if (before.indexOf(ann.textPrefix.slice(-15)) >= 0) return idx;
    }
    if (idx >= 0) return idx;
    return -1;
  }

  // --- Annotation: tooltip on hover ---

  textLayerDiv.addEventListener('mouseover', function (e) {
    var target = e.target;
    if (target.classList && target.classList.contains('learncode-highlight')) {
      var note = target.getAttribute('data-note');
      if (note) {
        tooltip.textContent = note;
        tooltip.style.left = e.pageX + 'px';
        tooltip.style.top = (e.pageY - 30) + 'px';
        tooltip.style.display = 'block';
      }
    }
  });

  textLayerDiv.addEventListener('mouseout', function (e) {
    var target = e.target;
    if (target.classList && target.classList.contains('learncode-highlight')) {
      tooltip.style.display = 'none';
    }
  });

  // --- Annotation: click popup with delete ---

  textLayerDiv.addEventListener('click', function (e) {
    var target = e.target;
    if (!target.classList || !target.classList.contains('learncode-highlight')) return;

    var note = target.getAttribute('data-note');
    var id = target.getAttribute('data-annotation-id');
    if (!id) return;

    tooltip.style.display = 'none';
    annotationPopup.innerHTML = '';

    if (note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'annotation-popup-note';
      noteEl.textContent = note;
      annotationPopup.appendChild(noteEl);
    } else {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'annotation-popup-note';
      emptyEl.textContent = '(highlight only)';
      emptyEl.style.fontStyle = 'italic';
      annotationPopup.appendChild(emptyEl);
    }

    var deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'annotation-popup-delete';
    deleteBtn.addEventListener('click', function () {
      vscode.postMessage({ command: 'removeAnnotation', id: id });
      annotationPopup.style.display = 'none';
    });
    annotationPopup.appendChild(deleteBtn);

    annotationPopup.style.left = e.pageX + 'px';
    annotationPopup.style.top = (e.pageY + 10) + 'px';
    annotationPopup.style.display = 'block';
  });

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
    switch (message.command) {
      case 'navigateToPage':
        renderPage(message.page);
        break;
      case 'loadAnnotations':
        applyAnnotations(message.annotations);
        break;
      case 'highlightAnnotation':
        currentAnnotations.push(message.annotation);
        applyAnnotations(currentAnnotations);
        break;
    }
  });

  // Start
  init();

})();
