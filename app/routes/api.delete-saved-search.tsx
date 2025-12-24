import { type ActionFunctionArgs, json } from "@remix-run/node";
import { getUserId } from "~/lib/session.server";
import prisma from "@common/utils/prisma.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await getUserId(request);
  
  if (!userId) {
    return json({ error: "You must be logged in to delete searches" }, { status: 401 });
  }

  const formData = await request.formData();
  const searchId = formData.get("searchId");

  if (!searchId || typeof searchId !== "string") {
    return json({ error: "Search ID is required" }, { status: 400 });
  }

  try {
    // Make sure the search belongs to the current user before deleting
    const search = await prisma.savedSearch.findUnique({
      where: { id: parseInt(searchId) }
    });

    if (!search) {
      return json({ error: "Search not found" }, { status: 404 });
    }

    if (search.userId !== userId) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.savedSearch.delete({
      where: { id: parseInt(searchId) }
    });

    return json({ success: true, message: "Search deleted successfully" });
  } catch (error) {
    console.error("Error deleting search:", error);
    return json({ error: "Failed to delete search" }, { status: 500 });
  }
}
