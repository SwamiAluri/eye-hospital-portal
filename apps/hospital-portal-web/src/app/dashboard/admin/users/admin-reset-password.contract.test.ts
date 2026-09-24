import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const apiSrc = readFileSync(
  join(__dirname, '../../../../lib/api.ts'),
  'utf8',
);

describe('Admin Users — Reset Password (Send Email) contract', () => {
  it('opens confirmation dialog with Send Email and target email', () => {
    expect(pageSrc).toContain("title: 'Send Password Reset'");
    expect(pageSrc).toContain('confirmText: \'Send Email\'');
    expect(pageSrc).toContain('Send password reset email to');
    expect(pageSrc).toContain('user.email');
  });

  it('Send Email calls usersApi.requestPasswordReset with selected user id', () => {
    expect(apiSrc).toContain('requestPasswordReset:');
    expect(apiSrc).toMatch(/requestPasswordReset:\s*\(id:\s*string\)\s*=>\s*getApi\(\)\.post\(`\/users\/\$\{id\}\/reset-password`\)/);
    expect(pageSrc).toContain('usersApi.requestPasswordReset(user.id)');
    expect(pageSrc).not.toContain('fetch(`${apiUrl}/users/${user.id}/reset-password`');
  });

  it('surfaces backend errors and keeps dialog open on failure', () => {
    const resetBlockStart = pageSrc.indexOf('const handleResetPassword');
    expect(resetBlockStart).toBeGreaterThanOrEqual(0);
    const nextHandler = pageSrc.indexOf('const filteredUsers', resetBlockStart);
    const block = pageSrc.slice(resetBlockStart, nextHandler > 0 ? nextHandler : undefined);

    expect(block).toContain('setError');
    expect(block).toContain('throw');
    expect(block).toMatch(/err\.response\?\.data\?\.message|errorData\.message/);
    // Prefer API message over generic TypeError "Failed to fetch" when backend returns one.
    expect(block).not.toMatch(/setError\(\s*['"]Failed to fetch['"]\s*\)/);
  });

  it('successful Send Email path uses requestPasswordReset success handling', () => {
    const resetBlockStart = pageSrc.indexOf('const handleResetPassword');
    const nextHandler = pageSrc.indexOf('const filteredUsers', resetBlockStart);
    const block = pageSrc.slice(resetBlockStart, nextHandler > 0 ? nextHandler : undefined);

    expect(block).toContain('onConfirm:');
    expect(block).toContain('await usersApi.requestPasswordReset(user.id)');
  });

  it('Cancel path does not invoke reset API (only onConfirm sends)', () => {
    const resetBlockStart = pageSrc.indexOf('const handleResetPassword');
    const nextHandler = pageSrc.indexOf('const filteredUsers', resetBlockStart);
    const block = pageSrc.slice(resetBlockStart, nextHandler > 0 ? nextHandler : undefined);

    expect(block).toContain('onConfirm:');
    expect(block).not.toContain('onCancel:');
    expect(block.match(/requestPasswordReset/g)?.length).toBe(1);
  });

  it('notification failure surfaces backend message and keeps dialog usable', () => {
    const resetBlockStart = pageSrc.indexOf('const handleResetPassword');
    const nextHandler = pageSrc.indexOf('const filteredUsers', resetBlockStart);
    const block = pageSrc.slice(resetBlockStart, nextHandler > 0 ? nextHandler : undefined);

    expect(block).toContain('err.response?.data?.message');
    expect(block).toContain('throw err');
    expect(block).not.toMatch(/setError\(\s*['"]Failed to fetch['"]\s*\)/);
  });
});
