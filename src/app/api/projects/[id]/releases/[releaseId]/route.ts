import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string; releaseId: string }>;
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { id, releaseId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const release = await prisma.release.findFirst({
    where: { id: releaseId, projectId: id },
  });

  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, status, plannedDate, releasedAt, notes } = body;

  const updated = await prisma.release.update({
    where: { id: releaseId },
    data: {
      ...(name !== undefined && { name }),
      ...(status !== undefined && { status }),
      ...(plannedDate !== undefined && {
        plannedDate: plannedDate ? new Date(plannedDate) : null,
      }),
      ...(releasedAt !== undefined && {
        releasedAt: releasedAt ? new Date(releasedAt) : null,
      }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id, releaseId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const release = await prisma.release.findFirst({
    where: { id: releaseId, projectId: id },
  });

  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  // Only allow deleting manual releases
  if (release.source !== "manual") {
    return NextResponse.json(
      { error: "Cannot delete non-manual releases" },
      { status: 403 }
    );
  }

  await prisma.release.delete({ where: { id: releaseId } });

  return NextResponse.json({ success: true });
}
