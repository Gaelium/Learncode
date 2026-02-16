(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  function navigate(direction) {
    vscode.postMessage({ command: 'navigate', direction: direction });
  }

  // Top navigation buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', function () { navigate(-1); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () { navigate(1); });
  }

  // Bottom navigation buttons
  const prevBtnBottom = document.getElementById('prevBtnBottom');
  const nextBtnBottom = document.getElementById('nextBtnBottom');

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
})();
