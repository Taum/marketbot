import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";

const prisma = new PrismaClient();

// create cookie file if it doesn't exists
try {
  await fs.access("tmp/cookies");
} catch (error) {
  throw new Error("tmp/cookie file is required to perform seeding. Please refer to README.");
}

const cookies = await fs.readFile("tmp/cookies", "utf8");
const cookiesJson = JSON.parse(cookies);

const sessionName = process.env["ALT_SESSION_NAME"];
if (!sessionName) {
  throw new Error("ALT_SESSION_NAME is not set");
}

let cookiesForDb: { name: string; value: string; expires: string }[] = [];
for (let key in cookiesJson["Response Cookies"]){
  const val = cookiesJson["Response Cookies"][key]
  cookiesForDb.push({
    name: key,
    value: val.value,
    expires: val.expires,
  });
}

const session = await prisma.altggSession.findFirst({
  where: {
    name: sessionName,
  },
});

if (!session) {
  console.log("Creating seed session");
  await prisma.altggSession.create({
    data: {
      name: sessionName,
      refreshCookies: cookiesForDb,
    },
  });
} else {
  console.log("Session already exists, overwriting cookies " + sessionName);
  await prisma.altggSession.update({
    where: { id: session.id },
    data: { refreshCookies: cookiesForDb },
  });
}
