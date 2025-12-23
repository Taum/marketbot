import bcrypt from "bcryptjs";
import prisma from "@common/utils/prisma.server";

export async function createUser(email: string, password: string, name?: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  });
}

export async function verifyLogin(emailOrName: string, password: string) {
  // Try to find user by email first, then by name
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrName },
        { name: emailOrName },
      ],
    },
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
}
