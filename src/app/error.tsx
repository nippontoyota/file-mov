"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="narrow panel"><h1>Workspace unavailable</h1><p>The connection could not be confirmed. Your access and work have not been assumed complete. Try loading the page again.</p><button onClick={reset}>Try again</button></section>;
}
