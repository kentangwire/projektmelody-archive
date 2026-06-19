const MAX_COMMENT_BODY = 500;
const MAX_COMMENT_NAME = 32;
const MAX_TIMESTAMP_DESC = 60;

export function containsHtmlOrUrl(s) {
  if (/<[^>]*>/.test(s)) return true;
  if (/https?:\/\//i.test(s)) return true;
  return false;
}

export function parseDisplayName(raw) {
  if (raw == null || raw === '') throw validationError('displayName is required');
  if (typeof raw !== 'string') throw validationError('displayName must be a string');
  const trimmed = raw.trim();
  if (!trimmed) throw validationError('displayName is required');
  if (trimmed.length > MAX_COMMENT_NAME) throw validationError('displayName too long');
  if (!/^[\w\s\-_.]{1,32}$/u.test(trimmed)) {
    throw validationError('displayName contains invalid characters');
  }
  return trimmed;
}

export function parseTimeInSec(raw) {
  if (raw == null || raw === '') return null;
  if (!Number.isInteger(raw)) throw validationError('timeInSec must be an integer');
  if (raw < 0) throw validationError('timeInSec must be >= 0');
  return raw;
}

export function parseCommentBody(body) {
  if (!body || typeof body !== 'object') throw validationError('Invalid body');
  if (typeof body.body !== 'string') throw validationError('body must be a string');
  const trimmed = body.body.trim();
  if (!trimmed) throw validationError('body is required');
  if (trimmed.length > MAX_COMMENT_BODY) throw validationError('body too long');
  if (containsHtmlOrUrl(trimmed)) throw validationError('body contains forbidden content');

  let parentId = null;
  if (body.parentId != null && body.parentId !== '') {
    if (typeof body.parentId !== 'string') throw validationError('parentId must be a string');
    parentId = body.parentId.trim() || null;
  }

  return {
    body: trimmed,
    displayName: parseDisplayName(body.displayName),
    parentId,
    timeInSec: parseTimeInSec(body.timeInSec)
  };
}

export function parseTimestampBody(body) {
  if (!body || typeof body !== 'object') throw validationError('Invalid body');
  const { timeInSec, description } = body;
  if (!Number.isInteger(timeInSec)) throw validationError('timeInSec must be an integer');
  if (typeof description !== 'string') throw validationError('description must be a string');
  const trimmed = description.trim();
  if (!trimmed) throw validationError('description is required');
  if (trimmed.length > MAX_TIMESTAMP_DESC) throw validationError('description too long');
  if (containsHtmlOrUrl(trimmed)) throw validationError('description contains forbidden content');
  if (timeInSec < 0) throw validationError('timeInSec must be >= 0');
  return { timeInSec, description: trimmed };
}

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'BAD_REQUEST';
  return err;
}

export function isValidationError(err) {
  return err && err.status === 400 && err.code === 'BAD_REQUEST';
}
