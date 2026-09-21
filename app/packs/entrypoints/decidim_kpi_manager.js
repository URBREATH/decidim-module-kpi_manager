// Images
require.context("../images", true)

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clipboard-copy]");

  if (!button) {
    return;
  }

  navigator.clipboard.writeText(button.dataset.clipboardCopy).then(() => {
    const originalText = button.textContent;

    button.textContent = "✓";
    setTimeout(() => { button.textContent = originalText; }, 1500);
  });
});
