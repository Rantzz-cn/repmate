import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { LandingEnhancements } from "@/components/landing-enhancements";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

function landingMarkup() {
  const source = fs.readFileSync(path.join(process.cwd(), "src/content/landing.html"), "utf8");
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replaceAll('href="login.html"', 'href="/login"')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('href="assets/', 'href="/assets/');
}

function landingStyles() {
  return ["landing.css", "numeric.css"]
    .map((file) => fs.readFileSync(path.join(process.cwd(), "public/styles", file), "utf8"))
    .join("\n");
}

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RepMate",
    url: "https://www.rep-mate.app/",
    applicationCategory: "HealthApplication",
    operatingSystem: "Android, Web",
    description: "A workout tracker for building routines, logging sets and reps, learning exercise form, and tracking strength progress.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: "https://www.rep-mate.app/downloads/RepMate.apk",
    featureList: ["Workout routine builder", "Set and rep tracking", "Exercise demonstrations", "Training volume and progress history", "Offline workout access"],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <style dangerouslySetInnerHTML={{ __html: landingStyles() }} />
    <div dangerouslySetInnerHTML={{ __html: landingMarkup() }} />
    <LandingEnhancements />
  </>;
}
