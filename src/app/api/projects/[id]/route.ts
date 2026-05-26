import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      tasks: {
        include: { metadata: true },
        orderBy: { updatedAt: "desc" },
      },
      releases: { orderBy: { createdAt: "desc" } },
      goals: { orderBy: { createdAt: "desc" } },
      commitDailies: {
        orderBy: { day: "desc" },
        take: 90,
      },
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 10,
      },
      privateNote: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
