import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { authenticator } from "~/lib/auth.server";
import { createUserSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await authenticator.authenticate("google", request, {
      throwOnError: true,
    });
    
    // Create a session with userId (compatible with existing session system)
    return createUserSession(user.id, "/");
  } catch (error) {
    // If authentication fails, redirect to login
    console.error("Google OAuth error:", error);
    return redirect("/login?error=auth_failed");
  }
}
