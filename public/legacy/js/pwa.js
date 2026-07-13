export async function setupPWA() {
  const developmentHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (developmentHost) {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('repmate-')).map((key) => caches.delete(key)));
    }
    return;
  }
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });
      await registration.update();
      registration.waiting?.postMessage('SKIP_WAITING');
    } catch (error) {
      console.error(error);
    }
  }
  let prompt;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e;
    document.body.dataset.installable = 'true';
  });
  document.addEventListener('click', async (e) => {
    if (e.target.dataset.install && prompt) {
      prompt.prompt();
      await prompt.userChoice;
      prompt = null;
    }
  });
}
