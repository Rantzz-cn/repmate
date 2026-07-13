import { supabase } from './supabase.js';

const root = document.querySelector('#auth-root');
const legalDialog = document.querySelector('#legal-dialog');
const legalContent = document.querySelector('#legal-content');
const reportError = (error, context) => window.__REPMATE_CAPTURE_ERROR__?.(error, context);

const legalDocuments = {
  terms: {
    eyebrow: 'RepMate Legal',
    title: 'Terms of Service',
    intro: 'These terms govern your use of RepMate. By continuing with Google or using the service, you agree to them.',
    sections: [
      ['1. Using RepMate', 'Keep your Google account secure and use RepMate only for lawful personal fitness purposes. You are responsible for activity performed through your account.'],
      ['2. Fitness and Health Notice', 'RepMate provides workout tracking and general educational information, not medical advice. Consult a qualified healthcare professional before changing an exercise program, especially if you have an injury or medical condition.'],
      ['3. Your Content', 'You retain ownership of workout entries, routines, notes, and photos you upload. You allow RepMate to process that content only as needed to provide the service.'],
      ['4. Acceptable Use', 'Do not misuse the service, attempt unauthorized access, disrupt its operation, upload unlawful content, or use RepMate to harm another person.'],
      ['5. Availability', 'Features may be updated, improved, suspended, or discontinued. Uninterrupted or error-free availability is not guaranteed.'],
      ['6. Account Closure', 'You may stop using RepMate or request deletion of your account data. Accounts that compromise the service may be restricted.'],
      ['7. Liability', 'To the extent allowed by law, RepMate is not responsible for injuries or losses caused by improper exercise or reliance on general workout information.'],
    ],
  },
  privacy: {
    eyebrow: 'Your Data',
    title: 'Privacy Policy',
    intro: 'This policy explains what RepMate stores, why it is used, and the choices available to you.',
    sections: [
      ['1. Information We Collect', 'Google provides your name, email, and account identifier. RepMate also stores routines, exercises, weights, repetitions, readiness entries, notes, progress, and optional session photos you provide.'],
      ['2. How We Use Information', 'Information is used to authenticate you, synchronize training data, calculate progress, personalize the experience, and create workout recaps.'],
      ['3. Storage', 'Account and workout data use Supabase authentication and database services. A local offline cache may remain on your device and synchronize when internet access returns.'],
      ['4. Sharing', 'RepMate does not sell personal data. Information is shared only with required infrastructure providers, when you use a sharing feature, or when legally required.'],
      ['5. Photos and Recaps', 'Session photos remain associated with the workout record. Recap images are generated on your device, and you decide whether to save or share them.'],
      ['6. Security and Retention', 'Authenticated access and database policies isolate user records. Data is retained while needed to provide RepMate, subject to legal requirements.'],
      ['7. Your Choices', 'You may update profile information, delete completed sessions, stop using the service, or request account deletion. Optional notes and photos are not required.'],
    ],
  },
};

function appUrl() {
  return new URL('app/', document.baseURI).href;
}

function openLegalDocument(type) {
  const policy = legalDocuments[type];
  legalContent.innerHTML = `<header class="legal-dialog__head"><div><p class="eyebrow">${policy.eyebrow}</p><h2 id="legal-title">${policy.title}</h2><p>Effective July 13, 2026</p></div><button type="button" data-legal-close aria-label="Close ${policy.title}">×</button></header><div class="legal-dialog__body"><p class="legal-dialog__intro">${policy.intro}</p>${policy.sections.map(([title, text]) => `<section><h3>${title}</h3><p>${text}</p></section>`).join('')}<p class="legal-dialog__note">Questions about these terms or your information can be directed to RepMate support.</p></div>`;
  legalContent.querySelector('[data-legal-close]').onclick = () => legalDialog.close();
  legalDialog.showModal();
}

function render(message = '') {
  root.innerHTML = `<section class="login-card google-only-card"><header class="login-card__head"><img src="assets/images/whitelogo.png" alt="RepMate"><p class="eyebrow">One Account. Every Rep.</p><h1>Continue to RepMate</h1><p>Use your Google account to securely save and sync your training.</p></header>${message ? `<p class="login-message" role="alert">${message}</p>` : ''}<button class="google-button" type="button"><span class="google-mark">G</span><span>Continue with Google</span></button><p class="google-auth-note">New here? Your RepMate account is created automatically.</p><p class="auth-legal-links">By continuing, you agree to the <button type="button" data-legal="terms">Terms of Service</button> and acknowledge the <button type="button" data-legal="privacy">Privacy Policy</button>.</p></section>`;
  const googleButton = root.querySelector('.google-button');
  googleButton.onclick = async () => {
    googleButton.disabled = true;
    googleButton.querySelector('span:last-child').textContent = 'Connecting to Google…';
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
    if (error) {
      reportError(error, { feature: 'google-auth' });
      render(error.message);
    }
  };
  root.querySelectorAll('[data-legal]').forEach((button) => {
    button.onclick = () => openLegalDocument(button.dataset.legal);
  });
}

legalDialog.addEventListener('click', (event) => {
  if (event.target === legalDialog) legalDialog.close();
});

const { data } = await supabase.auth.getSession();
if (data.session) location.replace(`${appUrl()}#today`);
else render();
