import { NextRequest, NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/errors";

// GET shows an interstitial; link scanners must not consume a one-time token.
export async function GET(request: NextRequest) {
  const url = new URL("/confirm", process.env.APP_ORIGIN || "http://127.0.0.1:3000");
  for (const key of ["token_hash", "type", "invitation"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const appOrigin = new URL(process.env.APP_ORIGIN || "http://127.0.0.1:3000").origin;
  if (origin !== appOrigin) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData();
  const token = form.get("token_hash");
  const type = form.get("type");
  const invitation = form.get("invitation");
  const target = new URL("/link-error", appOrigin);
  if (typeof token !== "string" || token.length > 512 || !token || (type !== "invite" && type !== "recovery")) return NextResponse.redirect(target, 303);
  const client = await userClient();
  const { error } = await client.auth.verifyOtp({ token_hash: token, type });
  if (!error) {
    if (type === "invite") {
      if (typeof invitation !== "string" || !uuid.test(invitation)) return NextResponse.redirect(target, 303);
      const result = await client.rpc("accept_staff_invitation", { p_invitation: invitation });
      if (result.error) return NextResponse.redirect(target, 303);
    }
    target.pathname = "/password";
  }
  return NextResponse.redirect(target, 303);
}
