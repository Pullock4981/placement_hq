const REHIRED_SIGNAL = /\b(?:re[\s-]?hire(?:d)?|re[\s-]?join(?:ed|ing)?|career\s+upgrad(?:e|ed|ation))\b/i;
const FRESH_OR_UPGRADED_FIELD = /fresher\s+or\s+career\s+upgrad(?:e|ed|ation)\s*[:：]\s*([^\r\n]+)/gi;

export function isRehiredPlacement(...signals: Array<string | null | undefined>) {
  const searchable = signals.filter(Boolean).join(' ').replace(FRESH_OR_UPGRADED_FIELD, '$1');
  return REHIRED_SIGNAL.test(searchable);
}

export function classifyPlacement(...signals: Array<string | null | undefined>): 'fresh' | 'rehired' {
  return isRehiredPlacement(...signals) ? 'rehired' : 'fresh';
}
