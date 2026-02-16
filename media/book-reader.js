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
})();
