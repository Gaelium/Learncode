(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  function navigate(direction) {
    vscode.postMessage({ command: 'navigate', direction: direction });
  }

  // Top navigation buttons
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', function () { navigate(-1); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () { navigate(1); });
  }

  // Bottom navigation buttons
  var prevBtnBottom = document.getElementById('prevBtnBottom');
  var nextBtnBottom = document.getElementById('nextBtnBottom');

  if (prevBtnBottom) {
    prevBtnBottom.addEventListener('click', function () { navigate(-1); });
  }
  if (nextBtnBottom) {
    nextBtnBottom.addEventListener('click', function () { navigate(1); });
  }

  // Keyboard navigation
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      navigate(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      navigate(1);
    }
  });

  // Intercept link clicks
  document.addEventListener('click', function (e) {
    var target = e.target;
    // Walk up to find the <a> element
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (!target) return;

    var href = target.getAttribute('href');
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    // External links — open in browser
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
      vscode.postMessage({ command: 'openExternal', href: href });
      return;
    }

    // Same-page fragment (e.g. #Sec1, #Fig2)
    if (href.startsWith('#')) {
      var el = document.getElementById(href.substring(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Cross-page link (e.g. 513120_3_En_8_Chapter.xhtml#Fig10)
    vscode.postMessage({ command: 'linkClicked', href: href });
  });

  // Fragment scrolling — scroll to a specific element when the page loads
  var fragment = document.body.getAttribute('data-fragment');
  if (fragment) {
    var target = document.getElementById(fragment);
    if (target) {
      target.scrollIntoView({ behavior: 'instant' });
    }
  }

  // --- Scroll position reporting (debounced) ---

  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (maxScroll <= 0) return;
      var fraction = window.scrollY / maxScroll;
      vscode.postMessage({ command: 'scrollPosition', scrollFraction: Math.min(1, Math.max(0, fraction)) });
    }, 2000);
  });

  // --- Annotation: floating button ---

  var bookContent = document.querySelector('.book-content');
  var currentAnnotations = [];

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

  // Get the current spine index from the page-info text (e.g. "3 / 15")
  function getCurrentSpineIndex() {
    var pageInfo = document.querySelector('.page-info');
    if (pageInfo) {
      var text = pageInfo.textContent || '';
      var match = text.match(/(\d+)\s*\/\s*\d+/);
      if (match) return parseInt(match[1], 10) - 1; // 0-based
    }
    return 0;
  }

  function getTextContext(container, selText, charsBefore, charsAfter) {
    var fullText = container.textContent || '';
    var idx = fullText.indexOf(selText);
    var matchLen = selText.length;

    // Fallback: whitespace-flexible matching (getSelection adds \n between
    // block elements but textContent concatenates without separators)
    if (idx < 0) {
      var result = flexMatch(fullText, selText);
      if (result) { idx = result.start; matchLen = result.end - result.start; }
    }

    if (idx < 0) return { prefix: '', suffix: '' };
    var prefix = fullText.substring(Math.max(0, idx - charsBefore), idx);
    var suffix = fullText.substring(idx + matchLen, idx + matchLen + charsAfter);
    return { prefix: prefix, suffix: suffix };
  }

  if (bookContent) {
    bookContent.addEventListener('mouseup', function (e) {
      var sel = window.getSelection();
      var selText = sel ? sel.toString().trim() : '';
      if (!selText) {
        annotateBtn.style.display = 'none';
        return;
      }

      annotateBtn.style.left = e.pageX + 'px';
      annotateBtn.style.top = (e.pageY - 35) + 'px';
      annotateBtn.style.display = 'block';
    });
  }

  annotateBtn.addEventListener('mousedown', function (e) {
    e.preventDefault(); // keep selection alive
  });

  annotateBtn.addEventListener('click', function () {
    var sel = window.getSelection();
    var selText = sel ? sel.toString().trim() : '';
    if (!selText || !bookContent) {
      annotateBtn.style.display = 'none';
      return;
    }

    var ctx = getTextContext(bookContent, selText, 30, 30);

    vscode.postMessage({
      command: 'addAnnotation',
      selectedText: selText,
      textPrefix: ctx.prefix,
      textSuffix: ctx.suffix,
      pageOrSpineIndex: getCurrentSpineIndex(),
    });

    annotateBtn.style.display = 'none';
    sel.removeAllRanges();
  });

  document.addEventListener('mousedown', function (e) {
    if (e.target !== annotateBtn && !annotateBtn.contains(e.target)) {
      annotateBtn.style.display = 'none';
    }
    if (!annotationPopup.contains(e.target) &&
        !(e.target.tagName === 'MARK' && e.target.classList.contains('learncode-annotation'))) {
      annotationPopup.style.display = 'none';
    }
  });

  // --- Annotation: highlight rendering using TreeWalker ---

  function applyAnnotations(annotations) {
    currentAnnotations = annotations || [];
    if (!bookContent) return;

    // Remove existing marks first
    var existing = bookContent.querySelectorAll('mark.learncode-annotation');
    for (var i = existing.length - 1; i >= 0; i--) {
      var mark = existing[i];
      var parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }

    for (var a = 0; a < currentAnnotations.length; a++) {
      highlightInContent(currentAnnotations[a]);
    }
  }

  function highlightInContent(ann) {
    if (!bookContent) return;

    // Walk text nodes to find the annotation text
    var walker = document.createTreeWalker(bookContent, NodeFilter.SHOW_TEXT, null, false);
    var fullText = '';
    var textNodes = [];

    var node;
    while ((node = walker.nextNode())) {
      textNodes.push({ node: node, start: fullText.length });
      fullText += node.textContent;
    }

    var result = findAnnotationIndex(fullText, ann);
    if (!result) return;

    var idx = result.start;
    var endIdx = result.end;

    // Find overlapping text nodes and wrap them
    for (var i = textNodes.length - 1; i >= 0; i--) {
      var tn = textNodes[i];
      var nodeEnd = tn.start + tn.node.textContent.length;
      if (nodeEnd <= idx || tn.start >= endIdx) continue;

      var nodeText = tn.node.textContent;
      var highlightStart = Math.max(0, idx - tn.start);
      var highlightEnd = Math.min(nodeText.length, endIdx - tn.start);

      var before = nodeText.substring(0, highlightStart);
      var highlighted = nodeText.substring(highlightStart, highlightEnd);
      var after = nodeText.substring(highlightEnd);

      var frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));

      var mark = document.createElement('mark');
      mark.className = 'learncode-annotation';
      mark.textContent = highlighted;
      mark.setAttribute('data-note', ann.note || '');
      mark.setAttribute('data-annotation-id', ann.id);
      frag.appendChild(mark);

      if (after) frag.appendChild(document.createTextNode(after));

      tn.node.parentNode.replaceChild(frag, tn.node);
    }
  }

  // Whitespace-flexible search: splits text on whitespace, builds a regex that
  // allows zero-or-more whitespace between chunks.  This handles the mismatch
  // between getSelection().toString() (adds \n between blocks) and textContent
  // (concatenates without separators).
  function flexMatch(fullText, selText) {
    var chunks = selText.split(/\s+/).filter(function (c) { return c.length > 0; });
    if (chunks.length === 0) return null;
    var pattern = chunks.map(function (c) {
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('\\s*');
    try {
      var m = new RegExp(pattern).exec(fullText);
      if (m) return { start: m.index, end: m.index + m[0].length };
    } catch (e) { /* invalid regex — fall through */ }
    return null;
  }

  function findAnnotationIndex(fullText, ann) {
    var idx = fullText.indexOf(ann.selectedText);
    if (idx >= 0) {
      if (ann.textPrefix) {
        var before = fullText.substring(Math.max(0, idx - 40), idx);
        if (before.indexOf(ann.textPrefix.slice(-15)) >= 0) {
          return { start: idx, end: idx + ann.selectedText.length };
        }
      }
      return { start: idx, end: idx + ann.selectedText.length };
    }
    // Fallback: whitespace-flexible matching
    return flexMatch(fullText, ann.selectedText);
  }

  // --- Annotation: tooltip on hover ---

  document.addEventListener('mouseover', function (e) {
    var target = e.target;
    if (target.tagName === 'MARK' && target.classList.contains('learncode-annotation')) {
      var note = target.getAttribute('data-note');
      if (note) {
        tooltip.textContent = note;
        tooltip.style.left = e.pageX + 'px';
        tooltip.style.top = (e.pageY - 30) + 'px';
        tooltip.style.display = 'block';
      }
    }
  });

  document.addEventListener('mouseout', function (e) {
    var target = e.target;
    if (target.tagName === 'MARK' && target.classList.contains('learncode-annotation')) {
      tooltip.style.display = 'none';
    }
  });

  // --- Annotation: click popup with delete ---

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || target.tagName !== 'MARK' || !target.classList.contains('learncode-annotation')) return;

    // Don't open popup if this was a link click
    if (target.closest('a')) return;

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

  // --- Messages from the extension ---

  window.addEventListener('message', function (event) {
    var message = event.data;
    switch (message.command) {
      case 'restoreScroll':
        var maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        if (maxScroll > 0 && message.scrollFraction > 0) {
          window.scrollTo(0, message.scrollFraction * maxScroll);
        }
        break;
      case 'loadAnnotations':
        applyAnnotations(message.annotations);
        break;
      case 'highlightAnnotation':
        currentAnnotations.push(message.annotation);
        highlightInContent(message.annotation);
        break;
    }
  });

  // Signal to the extension that the webview is ready to receive messages
  vscode.postMessage({ command: 'ready' });
})();
