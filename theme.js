// theme.js - Runs before the page paints. The theme is light unless the user picks another one.
function currentThemeChoice() {
  try {
    return localStorage.getItem('theme') || 'light';
  } catch (error) {
    return 'light';
  }
}

function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function setThemeChoice(choice) {
  try {
    localStorage.setItem('theme', choice);
  } catch (error) {
    // Without storage the choice still applies until this page closes
  }
  applyTheme(choice);
}

applyTheme(currentThemeChoice());
// The same page also runs as the side panel, where the browser decides the size
if (chrome.extension.getViews({ type: 'popup' }).includes(window)) document.documentElement.classList.add('in-popup');
// Keeps every open extension page on the same theme
addEventListener('storage', (event) => {
  if (event.key === 'theme') applyTheme(currentThemeChoice());
// The same page also runs as the side panel, where the browser decides the size
if (chrome.extension.getViews({ type: 'popup' }).includes(window)) document.documentElement.classList.add('in-popup');
});
