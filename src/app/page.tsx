import fs from "node:fs";
import path from "node:path";
import { LandingEnhancements } from "@/components/landing-enhancements";

function landingMarkup() {
  const source = fs.readFileSync(path.join(process.cwd(), "src/content/landing.html"), "utf8");
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replaceAll('href="login.html"', 'href="/login"')
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll('href="assets/', 'href="/assets/');
}

export default function LandingPage() {
  return <>
    <link rel="stylesheet" href="/legacy/css/landing.css" />
    <link rel="stylesheet" href="/legacy/css/numeric.css" />
    <div dangerouslySetInnerHTML={{ __html: landingMarkup() }} />
    <LandingEnhancements />
  </>;
}
