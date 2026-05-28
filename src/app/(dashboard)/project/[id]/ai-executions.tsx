'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

interface AiExecution {
  id: string
  taskId: string
  status: string
  plan: string | null
  diff: string | null
  logs: string | null
  errorMsg: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  task: {
    title: string
    status: string
  }
}

interface AiExecutionsTabProps {
  projectId: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  planning: 'bg-blue-500/20 text-blue-400',
  waiting_confirm: 'bg-purple-500/20 text-purple-400',
  executing: 'bg-orange-500/20 text-orange-400',
  done: 'bg-green-500/20 text-green-400',
  blocked: 'bg-red-500/20 text-red-400',
  failed: 'bg-red-500/20 text-red-400',
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  planning: <Loader2 className="h-4 w-4 animate-spin" />,
  waiting_confirm: <AlertCircle className="h-4 w-4" />,
  executing: <Loader2 className="h-4 w-4 animate-spin" />,
  done: <CheckCircle className="h-4 w-4" />,
  blocked: <XCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
}

export function AiExecutionsTab({ projectId }: AiExecutionsTabProps) {
  const [executions, setExecutions] = useState<AiExecution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExecutions()
  }, [projectId])

  const fetchExecutions = async () => {
    try {
      const response = await fetch(`/api/ai-execute?projectId=${projectId}`)
      const data = await response.json()
      if (data.executions) {
        setExecutions(data.executions)
      }
    } catch (error) {
      console.error('Failed to fetch AI executions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (executions.length === 0) {
    return (
      <div className="text-center p-8 text-zinc-500">
        <p>No AI executions yet.</p>
        <p className="text-sm mt-2">
          Add a task with the <code className="bg-zinc-800 px-1 rounded">ai-execute</code> tag to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {executions.map((execution) => (
        <Card key={execution.id} className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-zinc-200">
                {execution.task.title}
              </CardTitle>
              <Badge className={statusColors[execution.status] || 'bg-zinc-500/20 text-zinc-400'}>
                <span className="flex items-center gap-1">
                  {statusIcons[execution.status]}
                  {execution.status.replace('_', ' ')}
                </span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Created: {new Date(execution.createdAt).toLocaleString()}</p>
              {execution.startedAt && (
                <p>Started: {new Date(execution.startedAt).toLocaleString()}</p>
              )}
              {execution.completedAt && (
                <p>Completed: {new Date(execution.completedAt).toLocaleString()}</p>
              )}
              {execution.errorMsg && (
                <p className="text-red-400 mt-2">Error: {execution.errorMsg}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
