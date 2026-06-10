import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const QA_ARTIFACT_DIR = '.qa-artifacts';

export type QaFinding = {
  severity: 'info' | 'low' | 'medium' | 'high' | 'blocker';
  area: string;
  message: string;
};

export function hasBlockingFindings(findings: QaFinding[]) {
  return findings.some((finding) => finding.severity === 'high' || finding.severity === 'blocker');
}

export function qaMarkdown(title: string, findings: QaFinding[]) {
  const lines = [`# ${title}`, '', `Generated: ${new Date().toISOString()}`, ''];

  if (!findings.length) {
    lines.push('Verdict: PASS', '', 'No findings.');
    return `${lines.join('\n')}\n`;
  }

  lines.push(`Verdict: ${hasBlockingFindings(findings) ? 'FAIL' : 'PASS WITH NOTES'}`, '');
  for (const finding of findings) {
    lines.push(`- **${finding.severity.toUpperCase()}** ${finding.area}: ${finding.message}`);
  }

  return `${lines.join('\n')}\n`;
}

export async function writeQaReport(filename: string, title: string, findings: QaFinding[]) {
  await mkdir(QA_ARTIFACT_DIR, { recursive: true });
  const path = join(QA_ARTIFACT_DIR, filename);
  await writeFile(path, qaMarkdown(title, findings), 'utf8');
  return path;
}
