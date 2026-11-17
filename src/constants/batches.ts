export const BATCH_NAME = {
  BATCH_9: 'Batch 9',
  BATCH_10: 'Batch 10',
  BATCH_11: 'Batch 11',
  BATCH_12: 'Batch 12',
} as const;

export const BATCH_NAMES = [
  BATCH_NAME.BATCH_9,
  BATCH_NAME.BATCH_10,
  BATCH_NAME.BATCH_11,
  BATCH_NAME.BATCH_12,
] as const;

// Temporary filters for the current mock dataset. Live batch choices should come from the central sheet.
export const MOCK_REPORTING_BATCH_NAMES = [
  'batch-2024-Q1',
  'batch-2024-Q2',
  'batch-2024-Q3',
  'batch-2024-Q4',
  'batch-2025-Q1',
  'batch-2025-Q2',
  'batch-2025-Q3',
  'batch-2025-Q4',
] as const;

