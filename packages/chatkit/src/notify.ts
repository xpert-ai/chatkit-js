import type { XpertAIChatKit } from './chatkit'

export type ScheduleReminderPayload = {
  title: string
  content?: string | null
  date: string
  remindAt?: string | null
  state?: Record<string, unknown>
}

export type AutoTaskNotificationPayload = {
  title: string
  repo: string
  branch: string
  schedule: string
  frequency: 'once' | 'daily' | 'weekly'
  prompt: string
  summary?: string | null
  state?: Record<string, unknown>
}

export const buildScheduleReminderText = (payload: ScheduleReminderPayload): string => {
  const title = payload.title.trim()
  const dateText = payload.date.trim()
  const reminderPrefix = `[Schedule Reminder] ${dateText}`
  const body = payload.content && payload.content.trim() ? `\n${payload.content.trim()}` : ''
  return `${reminderPrefix}\n${title}${body}`
}

export async function sendScheduleReminder(
  chatkit: Pick<XpertAIChatKit, 'sendUserMessage'>,
  payload: ScheduleReminderPayload,
): Promise<void> {
  await chatkit.sendUserMessage({
    text: buildScheduleReminderText(payload),
    state: {
      kind: 'schedule_reminder',
      date: payload.date,
      remindAt: payload.remindAt ?? null,
      ...(payload.state ?? {}),
    },
  })
}

export const buildAutoTaskNotificationText = (payload: AutoTaskNotificationPayload): string => {
  const lines = [
    `[Auto Task] ${payload.title.trim()}`,
    `Repo: ${payload.repo.trim()}@${payload.branch.trim()}`,
    `Frequency: ${payload.frequency} | Schedule: ${payload.schedule.trim()}`,
    `Prompt: ${payload.prompt.trim()}`,
  ]
  if (payload.summary && payload.summary.trim()) {
    lines.push(`Summary: ${payload.summary.trim()}`)
  }
  return lines.join('\n')
}

export async function sendAutoTaskNotification(
  chatkit: Pick<XpertAIChatKit, 'sendUserMessage'>,
  payload: AutoTaskNotificationPayload,
): Promise<void> {
  await chatkit.sendUserMessage({
    text: buildAutoTaskNotificationText(payload),
    state: {
      kind: 'auto_task_notification',
      title: payload.title,
      repo: payload.repo,
      branch: payload.branch,
      frequency: payload.frequency,
      schedule: payload.schedule,
      ...(payload.state ?? {}),
    },
  })
}
