import Image from "next/image";
import Link from "next/link";
import { Dumbbell, RotateCw } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="offline-page grid-bg">
      <section className="offline-card" aria-labelledby="offline-title">
        <Image
          src="/assets/images/whitelogo.png"
          width={188}
          height={58}
          alt="RepMate"
          className="offline-card__logo"
          priority
        />
        <span className="offline-card__icon" aria-hidden="true"><Dumbbell /></span>
        <div>
          <p className="eyebrow">Offline mode</p>
          <h1 id="offline-title">You are still in the workout.</h1>
          <p>Previously loaded training remains available. New changes will sync when your connection returns.</p>
        </div>
        <Link className="offline-card__action" href="/app">
          <RotateCw aria-hidden="true" />
          Try RepMate again
        </Link>
      </section>
    </main>
  );
}
