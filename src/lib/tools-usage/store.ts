import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  ToolUsageRecord,
  ToolUsageSummary,
  ToolStatItem,
  UserToolStatItem,
} from './types';

// In Vercel serverless functions, the root filesystem is read-only.
// We use /tmp on Vercel, and src/data in local dev, plus an in-memory cache.
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_DATA_DIR = path.join(process.cwd(), 'src', 'data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'tools-usage.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'ph-tools-usage.json');

const ACTIVE_DATA_FILE = IS_VERCEL ? TMP_DATA_FILE : LOCAL_DATA_FILE;

let memoryRecordsCache: ToolUsageRecord[] | null = null;

export const KNOWN_TOOLS = [
  { id: 'ats-resume-check', name: 'ATS Resume Check', color: '#7c3aed' },
  { id: 'portfolio-check', name: 'Portfolio Check (60 Marks)', color: '#6366f1' },
  { id: 'github-profile-check', name: 'GitHub Profile Check', color: '#2563eb' },
  { id: 'resume-screening', name: 'Resume Screening Engine', color: '#0ea5e9' },
  { id: 'nexview-tool', name: 'NexView Screening Tool', color: '#10b981' },
  { id: 'ai-assignment-check', name: 'AI Assignment Check', color: '#f59e0b' },
];

export function getStoredUsageRecords(): ToolUsageRecord[] {
  if (memoryRecordsCache !== null) {
    return memoryRecordsCache;
  }

  try {
    // 1. Try reading from ACTIVE_DATA_FILE (/tmp on Vercel, src/data on local)
    if (fs.existsSync(ACTIVE_DATA_FILE)) {
      const raw = fs.readFileSync(ACTIVE_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryRecordsCache = parsed;
        return memoryRecordsCache;
      }
    }

    // 2. If on Vercel and /tmp doesn't have it yet, check bundled LOCAL_DATA_FILE
    if (IS_VERCEL && fs.existsSync(LOCAL_DATA_FILE)) {
      try {
        const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryRecordsCache = parsed;
          return memoryRecordsCache;
        }
      } catch {
        // ignore
      }
    }

    memoryRecordsCache = [];
    return memoryRecordsCache;
  } catch (err) {
    console.warn('[tools-usage] Could not read storage, defaulting to empty:', err);
    memoryRecordsCache = [];
    return memoryRecordsCache;
  }
}

export function trackToolUsage(entry: Omit<ToolUsageRecord, 'id' | 'timestamp'> & { timestamp?: string }): ToolUsageRecord {
  const records = getStoredUsageRecords();
  const newRecord: ToolUsageRecord = {
    ...entry,
    id: randomUUID(),
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  records.unshift(newRecord);
  memoryRecordsCache = records;

  try {
    const targetFile = ACTIVE_DATA_FILE;
    const targetDir = path.dirname(targetFile);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetFile, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    // Non-blocking in serverless environments
    console.warn('[tools-usage] File persistence skipped (in-memory preserved):', err);
  }

  return newRecord;
}

export function getToolsUsageSummary(): ToolUsageSummary {
  const records = getStoredUsageRecords();
  const totalExecutions = records.length;
  let totalCandidatesAudited = 0;

  const toolStatsMap: Record<
    string,
    {
      toolId: string;
      toolName: string;
      total: number;
      single: number;
      batch: number;
      candidates: number;
      lastTimestamp: number;
      color: string;
    }
  > = {};

  // Initialize known tools
  KNOWN_TOOLS.forEach((kt) => {
    toolStatsMap[kt.id] = {
      toolId: kt.id,
      toolName: kt.name,
      total: 0,
      single: 0,
      batch: 0,
      candidates: 0,
      lastTimestamp: 0,
      color: kt.color,
    };
  });

  const userStatsMap: Record<
    string,
    {
      userId: string;
      userName: string;
      userEmail: string;
      userRole: 'admin' | 'manager' | 'mentor';
      total: number;
      candidates: number;
      lastTimestamp: number;
      toolBreakdown: Record<string, number>;
    }
  > = {};

  records.forEach((rec) => {
    const candCount = rec.candidateCount || 1;
    totalCandidatesAudited += candCount;

    // Tool aggregation
    const tId = rec.toolId;
    if (!toolStatsMap[tId]) {
      toolStatsMap[tId] = {
        toolId: tId,
        toolName: rec.toolName || tId,
        total: 0,
        single: 0,
        batch: 0,
        candidates: 0,
        lastTimestamp: 0,
        color: '#8b5cf6',
      };
    }

    const tObj = toolStatsMap[tId];
    tObj.total++;
    if (rec.actionType === 'batch_audit') tObj.batch++;
    else tObj.single++;
    tObj.candidates += candCount;
    const timeMs = new Date(rec.timestamp).getTime();
    if (timeMs > tObj.lastTimestamp) tObj.lastTimestamp = timeMs;

    // User aggregation
    const uKey = (rec.userEmail || 'anonymous@programming-hero.com').toLowerCase();
    if (!userStatsMap[uKey]) {
      userStatsMap[uKey] = {
        userId: uKey,
        userName: rec.userName || 'Anonymous',
        userEmail: rec.userEmail,
        userRole: rec.userRole || 'mentor',
        total: 0,
        candidates: 0,
        lastTimestamp: 0,
        toolBreakdown: {},
      };
    }

    const uObj = userStatsMap[uKey];
    uObj.total++;
    uObj.candidates += candCount;
    if (timeMs > uObj.lastTimestamp) uObj.lastTimestamp = timeMs;
    const tName = rec.toolName || tId;
    uObj.toolBreakdown[tName] = (uObj.toolBreakdown[tName] || 0) + 1;
  });

  // Calculate percentages and sort
  const toolStats: ToolStatItem[] = Object.values(toolStatsMap)
    .map((t) => ({
      toolId: t.toolId,
      toolName: t.toolName,
      totalUsage: t.total,
      singleCount: t.single,
      batchCount: t.batch,
      candidatesAudited: t.candidates,
      lastUsed: t.lastTimestamp > 0 ? new Date(t.lastTimestamp).toISOString() : '',
      percentage: totalExecutions > 0 ? Math.round((t.total / totalExecutions) * 100) : 0,
      color: t.color,
    }))
    .sort((a, b) => b.totalUsage - a.totalUsage);

  const userStats: UserToolStatItem[] = Object.values(userStatsMap)
    .map((u) => {
      let maxTool = 'None';
      let maxCount = -1;
      Object.entries(u.toolBreakdown).forEach(([name, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxTool = name;
        }
      });

      return {
        userId: u.userId,
        userName: u.userName,
        userEmail: u.userEmail,
        userRole: u.userRole,
        totalUsage: u.total,
        candidatesAudited: u.candidates,
        lastActive: u.lastTimestamp > 0 ? new Date(u.lastTimestamp).toISOString() : '',
        toolBreakdown: u.toolBreakdown,
        primaryTool: maxTool,
      };
    })
    .sort((a, b) => b.totalUsage - a.totalUsage);

  const topToolItem = toolStats.find((t) => t.totalUsage > 0);

  return {
    totalExecutions,
    totalCandidatesAudited,
    uniqueUsersCount: Object.keys(userStatsMap).length,
    topTool: {
      toolName: topToolItem ? topToolItem.toolName : 'None',
      count: topToolItem ? topToolItem.totalUsage : 0,
    },
    toolStats,
    userStats,
    recentActivity: records.slice(0, 50),
  };
}
