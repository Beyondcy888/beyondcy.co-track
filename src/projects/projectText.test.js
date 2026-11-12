import { describe, expect, it } from 'vitest';
import { describeProjectActivity, descriptionLines, descriptionPreview, validateProject } from './projectText.js';

describe('descriptionLines', () => {
  it('keeps line breaks and makes only http(s) links clickable', () => {
    const lines = descriptionLines('Shot list: https://docs.google.com/x.\n\njavascript:alert(1)\nwww.example.com/page');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toEqual([
      { type: 'text', value: 'Shot list: ' },
      { type: 'link', value: 'https://docs.google.com/x', href: 'https://docs.google.com/x' },
      { type: 'text', value: '.' },
    ]);
    expect(lines[1]).toEqual([]); // the empty line stays
    expect(lines[2]).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
    expect(lines[3]).toEqual([{ type: 'link', value: 'www.example.com/page', href: 'https://www.example.com/page' }]);
  });

  it('handles empty text', () => {
    expect(descriptionLines(null)).toEqual([]);
    expect(descriptionLines('')).toEqual([]);
  });

  it('descriptionPreview takes the first non-empty line', () => {
    expect(descriptionPreview('\n  \nFirst line\nSecond')).toBe('First line');
    expect(descriptionPreview(null)).toBe('');
  });
});

describe('validateProject', () => {
  it('needs a name, a deadline and at least one person', () => {
    expect(validateProject({ name: '  ', dueDate: '', assignees: [] })).toEqual({
      name: 'Give the project a name.',
      dueDate: 'Choose a deadline.',
      assignees: 'Assign at least one person.',
    });
    expect(validateProject({ name: 'Shoot', dueDate: '2026-11-20', assignees: ['a'] })).toEqual({});
  });

  it('limits the name to 200 characters and refuses half-typed dates', () => {
    expect(validateProject({ name: 'x'.repeat(201), dueDate: '2026-11-20', assignees: ['a'] }).name).toMatch(/200/);
    expect(validateProject({ name: 'x'.repeat(200), dueDate: '2026-11-20', assignees: ['a'] })).toEqual({});
    expect(validateProject({ name: 'x', dueDate: '0002-11-20', assignees: ['a'] }).dueDate).toBe('That date is not valid.');
  });
});

describe('describeProjectActivity', () => {
  it('reads like a sentence', () => {
    expect(describeProjectActivity({ actor_name: 'Admin Beyondcy', action: 'project_created', changes: { project_id: 'p', due_date: '2026-11-20' } })).toEqual({
      actor: 'Admin Beyondcy',
      text: 'created this project',
      detail: 'Deadline 20 Nov 2026',
    });
    expect(describeProjectActivity({ actor_name: 'Dika', action: 'project_completed', changes: {} }).text).toBe('marked it as done');
    expect(describeProjectActivity({ actor_name: 'Dika', action: 'project_reopened', changes: {} }).text).toBe('reopened it');
  });

  it('names the changed fields and shows a moved deadline', () => {
    const d = describeProjectActivity({
      actor_name: 'Admin Beyondcy',
      action: 'project_updated',
      changes: { name: { old: 'A', new: 'B' }, due_date: { old: '2026-11-18', new: '2026-11-20' }, project_id: 'p' },
    });
    expect(d.text).toBe('changed the name and the deadline');
    expect(d.detail).toBe('18 Nov → 20 Nov');
  });

  it('falls back gracefully', () => {
    expect(describeProjectActivity({ action: 'project_updated', changes: {} })).toEqual({ actor: 'Someone', text: 'updated this project', detail: null });
  });
});
