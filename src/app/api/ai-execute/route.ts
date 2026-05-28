import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { taskId, projectId, action } = body

    // Validate required fields
    if (!taskId || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, projectId' },
        { status: 400 }
      )
    }

    // Verify task exists and has ai-execute tag
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { metadata: true }
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    if (!task.metadata?.tags?.includes('ai-execute')) {
      return NextResponse.json(
        { error: 'Task does not have ai-execute tag' },
        { status: 400 }
      )
    }

    // Check if execution already exists
    const existingExecution = await prisma.aiExecution.findUnique({
      where: { taskId }
    })

    if (existingExecution) {
      return NextResponse.json(
        { error: 'Execution already exists for this task' },
        { status: 409 }
      )
    }

    // Create AI execution record
    const execution = await prisma.aiExecution.create({
      data: {
        taskId,
        projectId,
        status: 'pending',
        startedAt: new Date()
      }
    })

    // Trigger Hermes Agent via webhook or cron
    // For now, we'll just create the record
    // The actual execution will be handled by a separate process

    return NextResponse.json({
      success: true,
      execution: {
        id: execution.id,
        taskId: execution.taskId,
        projectId: execution.projectId,
        status: execution.status
      }
    })

  } catch (error) {
    console.error('AI Execute webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const action = searchParams.get('action')

    // Handle archive action
    if (action === 'archive') {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      // Find done executions older than 2 days
      const toArchive = await prisma.aiExecution.findMany({
        where: {
          status: 'done',
          completedAt: {
            lt: twoDaysAgo
          }
        }
      })

      // Update status to archived (we'll add this status)
      // For now, just mark as done with a note
      const archived = await prisma.aiExecution.updateMany({
        where: {
          status: 'done',
          completedAt: {
            lt: twoDaysAgo
          }
        },
        data: {
          status: 'done', // Keep as done, but add archivedAt field later
          logs: 'Auto-archived after 2 days'
        }
      })

      return NextResponse.json({
        success: true,
        archived: archived.count
      })
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      )
    }

    // Get all AI executions for the project
    const executions = await prisma.aiExecution.findMany({
      where: { projectId },
      include: {
        task: {
          select: { title: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ executions })

  } catch (error) {
    console.error('AI Execute GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
