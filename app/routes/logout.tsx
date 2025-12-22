import { type ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/lib/session.server";

export async function action({ request }: ActionFunctionArgs) {
  return logout(request);
}

export async function loader() {
  // If someone navigates to /logout via GET, redirect to home
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
    },
  });
}
