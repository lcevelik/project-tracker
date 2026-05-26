import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// PUT /api/projects/[id]/settings — Update project settings
// ---------------------------------------------------------------------------

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.staleThresholdDays === "number" && body.staleThresholdDays > 0) {
    data.staleThresholdDays = body.staleThresholdDays;
  }

  if (typeof body.projectMdPath === "string" && body.projectMdPath.trim()) {
    data.projectMdPath = body.projectMdPath.trim();
  }

  if (typeof body.aiFallbackEnabled === "boolean") {
    data.aiFallbackEnabled = body.aiFallbackEnabled;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    staleThresholdDays: updated.staleThresholdDays,
    projectMdPath: updated.projectMdPath,
    aiFallbackEnabled: updated.aiFallbackEnabled,
  });
}
