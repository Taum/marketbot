import { type ActionFunctionArgs, json } from "@remix-run/node";
import { getUserId } from "~/lib/session.server";
import prisma from "@common/utils/prisma.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await getUserId(request);
  
  if (!userId) {
    return json({ error: "You must be logged in to save searches" }, { status: 401 });
  }

  const formData = await request.formData();
  const name = formData.get("name");
  const searchParams = formData.get("searchParams");

  if (!name || typeof name !== "string") {
    return json({ error: "Search name is required" }, { status: 400 });
  }

  if (!searchParams || typeof searchParams !== "string") {
    return json({ error: "Search parameters are required" }, { status: 400 });
  }

  try {
    // Check if a search with this name already exists for this user
    const existingSearch = await prisma.savedSearch.findUnique({
      where: {
        userId_name: {
          userId,
          name
        }
      }
    });

    if (existingSearch) {
      // Update the existing search
      await prisma.savedSearch.update({
        where: { id: existingSearch.id },
        data: { searchParams }
      });
    } else {
      // Create a new search
      await prisma.savedSearch.create({
        data: {
          userId,
          name,
          searchParams
        }
      });
    }

    return json({ success: true, message: "Search saved successfully" });
  } catch (error) {
    console.error("Error saving search:", error);
    return json({ error: "Failed to save search" }, { status: 500 });
  }
}
