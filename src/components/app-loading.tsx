export function AppLoading() {
  return (
    <div className="app-boot" role="status" aria-live="polite" aria-label="RepMate is getting ready">
      <img className="app-boot__logo" src="/assets/images/whitelogo.png" alt="RepMate" />
      <div className="app-boot__copy">
        <p>Getting your session ready</p>
        <span>This should only take a moment.</span>
      </div>
      <div className="app-boot__track" aria-hidden="true"><span /></div>
    </div>
  );
}
