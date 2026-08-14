(function () {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (!isNative) return;

  document.documentElement.classList.add('native-app');

  document.addEventListener('click', async function (event) {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    const isWeb = /^https?:/i.test(href);
    const isExternalScheme = /^(mailto|tel|sms|geo):/i.test(href);
    if (!isWeb && !isExternalScheme) return;

    event.preventDefault();
    try {
      if (isWeb && window.Capacitor.Plugins.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url: href });
      } else {
        window.location.href = href;
      }
    } catch (_) {
      window.location.href = href;
    }
  });

  if (window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', function ({ canGoBack }) {
      if (canGoBack) history.back();
      else window.Capacitor.Plugins.App.exitApp();
    });
  }
})();
