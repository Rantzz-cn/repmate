import { supabase } from './supabase.js';

async function updateServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', {
      updateViaCache: 'none',
    });
    await registration.update();
    registration.waiting?.postMessage('SKIP_WAITING');
  } catch (error) {
    console.error('RepMate update check failed.', error);
  }
}

async function continueExistingSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('RepMate session check failed.', error);
    return;
  }

  if (data.session) {
    location.replace(new URL('app/#today', document.baseURI));
  }
}

await updateServiceWorker();
await continueExistingSession();
