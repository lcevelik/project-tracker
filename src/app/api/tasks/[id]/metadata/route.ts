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

  // Verify the task belongs to a project owned by the user
  const task = await prisma.task.findFirst({
    where: {
      id,
      project: { userId: session.user.id },
    },
    include: { metadata: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task.metadata ?? null);
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the task belongs to a project owned by the user
  const task = await prisma.task.findFirst({
    where: {
      id,
      project: { userId: session.user.id },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await request.json();
  const { priority, dueDate, tags, notes } = body;

  // Validate priority
  const validPriorities = ["P0", "P1", "P2", "P3"];
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json(
      { error: "Invalid priority. Must be P0, P1, P2, or P3" },
      { status: 400 }
    );
  }

  // Upsert TaskMetadata (create if doesn't exist)
  const metadata = await prisma.taskMetadata.upsert({
    where: { taskId: id },
    create: {
      taskId: id,
      priority: priority ?? "P2",
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags ?? [],
      notes: notes ?? null,
    },
    update: {
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && {
        dueDate: dueDate ? new Date(dueDate) : null,
      }),
      ...(tags !== undefined && { tags }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(metadata);
}
