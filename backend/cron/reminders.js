// backend/cron/reminders.js
const cron = require('node-cron');
const Task = require('../models/Task');
const { sendText, sendTemplate } = require('../utils/whatsapp');
const { sendEmail, renderTemplate } = require('../utils/email');

/**
 * CONFIG
 * -------
 * REMINDER_DRY_RUN=1 -> will NOT actually send, only logs.
 * This cron sends a reminder ONCE per task using Task.reminderSent flag.
 */
const DRY_RUN = process.env.REMINDER_DRY_RUN === '1';

// ---------- time helpers (server local timezone) ----------
function startOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDaysLocal(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** return { start, nextMidnight } for the given date in server local time */
function dayRangeLocal(dateLike) {
  const start = startOfDayLocal(dateLike);
  const nextMidnight = addDaysLocal(start, 1); // next day's 00:00
  return { start, nextMidnight };
}
/** pretty local date for message bodies */
function prettyLocalDate(d) {
  try {
    return new Date(d).toDateString();
  } catch {
    return 'N/A';
  }
}

// ---------- core runner ----------
async function runOnce() {
  const now = new Date();

  // "tomorrow" window in server local time
  const tomorrow = addDaysLocal(now, 1);
  const { start: targetStart, nextMidnight: targetEnd } = dayRangeLocal(tomorrow);

  console.log('[reminder] tick:', {
    now: now.toString(),
    rangeStart: targetStart.toString(),
    rangeEndExcl: targetEnd.toString(),
    dryRun: DRY_RUN,
  });

  let tasks = [];
  try {
    tasks = await Task.find({
      // due tomorrow: [start, nextMidnight)
      dueDate: { $gte: targetStart, $lt: targetEnd },

      // KEY: ensure we only ever send once
      reminderSent: { $ne: true },

      // If your schema has 'status', you can also add:
      // status: { $ne: 'Done' },
    })
      .populate('assignees', 'name email phone')
      .populate('project', 'title')
      .lean();
  } catch (e) {
    console.error('[reminder] DB query error:', e);
    return;
  }

  console.log(`[reminder] tasks matched for tomorrow: ${tasks.length}`);

  for (const t of tasks) {
    const projectTitle = t.project?.title || 'Project';
    const duePretty = t.dueDate ? prettyLocalDate(t.dueDate) : 'N/A';

    // ---------- WhatsApp ----------
    for (const u of t.assignees || []) {
      if (!u?.phone) continue;

      const templateName = process.env.WHATSAPP_TEMPLATE_TASK_REMINDER;
      const waLogBase = `[reminder] WA -> ${u.phone} | task: "${t.title}" | project: "${projectTitle}" | due: ${duePretty}`;

      if (DRY_RUN) {
        console.log(waLogBase, '(DRY_RUN)');
      } else {
        try {
          if (templateName) {
            await sendTemplate({
              to: u.phone,
              templateName,
              bodyParams: [u.name || 'there', t.title, projectTitle, duePretty],
            })
              .then(r => console.log(waLogBase, '| template OK', r?.messageId || ''))
              .catch(e => console.error(waLogBase, '| template FAIL:', e?.message || e));
          } else {
            await sendText({
              to: u.phone,
              body: `⏰ Reminder: ${t.title}\nProject: ${projectTitle}\nDue: ${duePretty}`,
            })
              .then(r => console.log(waLogBase, '| text OK', r?.messageId || ''))
              .catch(e => console.error(waLogBase, '| text FAIL:', e?.message || e));
          }
        } catch (e) {
          console.error('[reminder] WA unexpected error:', e);
        }
      }
    }

    // ---------- Email ----------
    for (const u of t.assignees || []) {
      if (!u?.email) continue;

      const emailLogBase = `[reminder] Email -> ${u.email} | task: "${t.title}" | project: "${projectTitle}" | due: ${duePretty}`;

      if (DRY_RUN) {
        console.log(emailLogBase, '(DRY_RUN)');
      } else {
        try {
          const html = renderTemplate('taskReminder.html', {
            name: u.name || 'there',
            project: projectTitle,
            title: t.title,
            dueDate: duePretty,
          });

          await sendEmail(u.email, `[Reminder] ${t.title} due ${duePretty}`, html)
            .then(r => console.log(emailLogBase, '| OK', r?.messageId || ''))
            .catch(e => console.error(emailLogBase, '| FAIL:', e?.message || e));
        } catch (e) {
          console.error('[reminder] email unexpected error:', e);
        }
      }
    }

    // ---------- mark as reminded (ONE-TIME lock) ----------
    try {
      if (DRY_RUN) {
        console.log('[reminder] skip mark (DRY_RUN) for task:', t._id);
      } else {
        // race-safe: only set if not already marked
        const res = await Task.updateOne(
          { _id: t._id, reminderSent: { $ne: true } },
          { $set: { reminderSent: true } } // only fields defined in schema (strict: true)
        );
        if (res.modifiedCount === 0) {
          console.log('[reminder] task already marked, skipped:', t._id);
        }
      }
    } catch (e) {
      console.error('[reminder] mark reminderSent error:', e?.message || e);
    }
  }

  console.log('[reminder] cycle done.');
}

// ---------- schedule ----------
try {
  console.log('✅ Reminder cron loaded (runs every hour at :00). DRY_RUN =', DRY_RUN ? 'ON' : 'OFF');

  // run once immediately on startup (handy for testing right away)
  runOnce().catch(err => console.error('reminder runOnce (startup) error:', err));

  // then run every hour at minute 00
  cron.schedule('0 * * * *', () => {
    runOnce().catch(err => console.error('reminder cron runOnce error:', err?.message || err));
  });

  console.log('✅ Reminder cron started');
} catch (e) {
  console.error('❌ Failed to schedule reminder cron:', e);
}

module.exports = { runOnce };
