import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { getUserId } from "~/lib/session.server";
import prisma from "@common/utils/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  
  if (!userId) {
    return json({ searches: [] });
  }

  try {
    const searches = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        searchParams: true,
        updatedAt: true,
      }
    });

    return json({ searches });
  } catch (error) {
    console.error("Error loading saved searches:", error);
    return json({ searches: [] }, { status: 500 });
  }
}
