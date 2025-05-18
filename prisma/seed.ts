import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";

const prisma = new PrismaClient();

const cookies = await fs.readFile("tmp/cookies", "utf8");
const cookiesJson = JSON.parse(cookies);

const sessionName = "thist";

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
  console.log("Session already exists: " + sessionName);
}
