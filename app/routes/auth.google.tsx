import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import { authenticator } from "~/lib/auth.server";

export async function loader() {
  return redirect("/login");
}

export async function action({ request }: ActionFunctionArgs) {
  return authenticator.authenticate("google", request);
}
