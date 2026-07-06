
const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const LOG_DB_ID = process.env.LOG_DATABASE_ID;
const SUMMARY_DB_ID = process.env.SUMMARY_DATABASE_ID;

/**
 * Notionデータベースを全件取得
 */
async function getAllPages(databaseId) {
  let results = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: startCursor,
      page_size: 100,
    });

    results.push(...response.results);

    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }

  return results;
}

/**
 * "120分" → "2時間0分"
 */
function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h === 0) {
    return `${m}分`;
  }

  return `${h}時間${m}分`;
}

/**
 * 作業ログを集計
 */
function aggregateLogs(logs) {

  const taskTotals = {};
  const eventTotals = {};

  for (const page of logs) {

    const event =
      page.properties["イベント名"]?.rich_text?.[0]?.plain_text ?? "";

    const work =
      page.properties["作業名"]?.title?.[0]?.plain_text ?? "";

    const key =
      page.properties["集計用キー"]?.formula?.string ?? "";

    const minutes =
      page.properties["集計用(分)"]?.formula?.number ?? 0;

    if (!key) continue;

    if (!taskTotals[key]) {

      taskTotals[key] = {
        key,
        event,
        work,
        total: 0,
      };

    }

    taskTotals[key].total += minutes;

    eventTotals[event] = (eventTotals[event] || 0) + minutes;

  }

  return {
    taskTotals,
    eventTotals,
  };

}

module.exports = async (req, res) => {

  try {

    const logs = await getAllPages(LOG_DB_ID);

    const result = aggregateLogs(logs);

    return res.status(200).json({

      success: true,

      logCount: logs.length,

      taskCount: Object.keys(result.taskTotals).length,

      eventCount: Object.keys(result.eventTotals).length,

      tasks: result.taskTotals,

      events: result.eventTotals,

    });

  } catch (err) {

    return res.status(500).json({

      success: false,

      message: err.message,

      stack: err.stack,

    });

  }

};
