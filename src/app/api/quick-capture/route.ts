import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.quickCaptureItem.findMany({
    where: {
      userId: session.user.id,
      assignedToProjectId: null,
    },
    orderBy: { capturedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { text } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "text is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const item = await prisma.quickCaptureItem.create({
    data: {
      userId: session.user.id,
      text: text.trim(),
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, assignedToProjectId } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Verify the item belongs to the user
  const existing = await prisma.quickCaptureItem.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Quick capture item not found" },
      { status: 404 }
    );
  }

  // If assigning to a project, verify the project belongs to the user
  if (assignedToProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: assignedToProjectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
  }

  const item = await prisma.quickCaptureItem.update({
    where: { id },
    data: { assignedToProjectId: assignedToProjectId ?? null },
  });

  return NextResponse.json(item);
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Verify the item belongs to the user
  const existing = await prisma.quickCaptureItem.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Quick capture item not found" },
      { status: 404 }
    );
  }

  await prisma.quickCaptureItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
