import { json, type ActionFunctionArgs } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { getUserId, logout } from "~/lib/session.server";
import prisma from "@common/utils/prisma.server";

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Get the current user ID
  const userId = await getUserId(request);
  if (!userId) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get the password from form data
  const formData = await request.formData();
  const password = formData.get("password");

  if (typeof password !== "string" || !password) {
    return json({ error: "Password is required" }, { status: 400 });
  }

  // Get the user from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return json({ error: "User not found" }, { status: 404 });
  }

  // Verify the password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return json({ error: "Invalid password" }, { status: 400 });
  }

  // Delete the user
  await prisma.user.delete({
    where: { id: userId },
  });

  // Logout the user
  return logout(request);
}
