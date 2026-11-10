export default async function Confirm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <section className="narrow panel"><p className="eyebrow">Staff access</p><h1>Continue to your account</h1><p>Continue only if you requested a password reset or received this invitation from your administrator.</p><form action="/auth/confirm" method="post">{["token_hash", "type", "invitation"].map(key => <input key={key} type="hidden" name={key} value={typeof params[key] === "string" ? params[key] : ""} />)}<button>Continue</button></form></section>;
}
