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

  // Verify the project belongs to the user
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: { privateNote: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project.privateNote ?? { markdown: "" });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the project belongs to the user
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { markdown } = body;

  if (typeof markdown !== "string") {
    return NextResponse.json(
      { error: "markdown must be a string" },
      { status: 400 }
    );
  }

  const note = await prisma.privateNote.upsert({
    where: { projectId: id },
    create: {
      projectId: id,
      markdown,
    },
    update: {
      markdown,
    },
  });

  return NextResponse.json(note);
}
