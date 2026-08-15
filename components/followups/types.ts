export interface FollowUpListItem {
  id: string;
  applicationId: string;
  jobTitle: string | null;
  company: string | null;
  applicationStatus: string;
  dueDate: string;
  status: string;
  isDue: boolean;
  hasDraft: boolean;
}

export function relativeDueLabel(dueDate: string): string {
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "due today";
  if (days > 0) return `due in ${days} day${days === 1 ? "" : "s"}`;
  const overdue = Math.abs(days);
  return `overdue by ${overdue} day${overdue === 1 ? "" : "s"}`;
}
