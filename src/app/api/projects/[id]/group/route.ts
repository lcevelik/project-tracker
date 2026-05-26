import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// PUT /api/projects/[id]/group — Update a project's group
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

  // group can be a non-empty string or null (to remove from group)
  if (body.group !== null && typeof body.group !== "string") {
    return NextResponse.json(
      { error: "group must be a string or null" },
      { status: 400 }
    );
  }

  const groupValue = body.group === null ? null : body.group.trim() || null;

  const updated = await prisma.project.update({
    where: { id },
    data: { group: groupValue },
  });

  return NextResponse.json({ id: updated.id, group: updated.group });
}
