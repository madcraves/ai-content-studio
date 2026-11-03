
import cron from "node-cron";
import type { Database } from "./database";

let schedulerTask: cron.ScheduledTask | null = null;

export function startScheduler(
  db: Database,
  onDue: (jobId: number) => void
): void {
  if (schedulerTask) {
    schedulerTask.stop();
  }

  schedulerTask = cron.schedule("* * * * *", () => {
    try {
      const dueSchedules = db.getDueSchedules();

      for (const schedule of dueSchedules) {
        try {
          onDue(schedule.id);
          db.markScheduleTriggered(schedule.id);
        } catch (error) {
          console.error(
            `Schedule ${schedule.id} failed:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Scheduler error:", error);
    }
  });
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}
