import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie and gates every page except sign-in. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const url = request.nextUrl;
  const open = url.pathname.startsWith("/login") || url.pathname.startsWith("/auth") || url.pathname.startsWith("/api/cron");

  if (!user && !open) {
    const to = url.clone();
    to.pathname = "/login";
    to.search = "";
    to.searchParams.set("next", url.pathname + url.search);
    const email = url.searchParams.get("email");
    if (email) to.searchParams.set("email", email);
    return NextResponse.redirect(to);
  }
  if (user && url.pathname.startsWith("/login")) {
    const to = url.clone();
    to.pathname = "/projects";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
