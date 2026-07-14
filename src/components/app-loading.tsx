export function AppLoading({ route = "today" }: { route?: string }) {
  return (
    <div className="app-skeleton" role="status" aria-live="polite" aria-label={`Loading ${route} page`}>
      <span className="app-skeleton__sr">RepMate is loading.</span>
      <header className="app-skeleton__heading" aria-hidden="true">
        <span className="skeleton-line skeleton-line--date" />
        <span className="skeleton-line skeleton-line--title" />
      </header>
      <section className="skeleton-card skeleton-card--coach" aria-hidden="true">
        <span className="skeleton-avatar" />
        <span className="skeleton-bubble">
          <i className="skeleton-line skeleton-line--label" />
          <i className="skeleton-line skeleton-line--copy" />
        </span>
      </section>
      <section className="skeleton-card skeleton-card--plan" aria-hidden="true">
        <span className="skeleton-square" />
        <span className="skeleton-plan-copy">
          <i className="skeleton-line skeleton-line--label" />
          <i className="skeleton-line skeleton-line--medium" />
        </span>
        <span className="skeleton-button" />
      </section>
      <section className="skeleton-stats" aria-hidden="true">
        <span /><span /><span />
      </section>
      <section className="app-skeleton__readiness" aria-hidden="true">
        <span className="skeleton-line skeleton-line--section" />
        <div className="skeleton-options"><span /><span /><span /></div>
      </section>
      <section className="app-skeleton__recent" aria-hidden="true">
        <span className="skeleton-line skeleton-line--section" />
        <span className="skeleton-card skeleton-card--recent" />
      </section>
    </div>
  );
}
