import { expect, it } from 'vitest';
import { FrameSafeHttpError, HttpError } from './HttpError';
import { serializeFrameError } from './serializeFrameError';

it.each([0, 401, 403, 408, 429, 503])(
  'preserves HTTP %i across a real structured clone',
  (status) => {
    const error = Object.assign(new Error('Session refresh failed'), {
      status,
      retryAfterMs: 30_000,
    });
    const received = structuredClone(serializeFrameError(error));
    expect(HttpError.fromPossibleFrameSafeError(received)).toMatchObject({
      status,
      retryAfterMs: 30_000,
    });
  },
);

it.each([HttpError, FrameSafeHttpError])(
  'retains existing frame-safe metadata for %s',
  (ErrorType) => {
    const error = new ErrorType(
      'Unavailable',
      { status: 503, retryAfterMs: 10_000 },
      { requestId: 'request' },
    );
    expect(
      HttpError.fromPossibleFrameSafeError(
        structuredClone(serializeFrameError(error)),
      ),
    ).toMatchObject({
      status: 503,
      retryAfterMs: 10_000,
      metadata: { requestId: 'request' },
    });
  },
);

it('normalizes Retry-After from host HTTP headers without cloning their implementation', () => {
  const error = {
    message: 'Busy',
    status: 503,
    headers: new Headers({ 'Retry-After': '30' }),
  };
  const received = structuredClone(serializeFrameError(error));
  expect(HttpError.fromPossibleFrameSafeError(received)).toMatchObject({
    status: 503,
    retryAfterMs: 30_000,
  });
  expect(received).not.toHaveProperty('headers');
});

it('serializes a host HTTP error with uncloneable DOM state without forwarding that state', () => {
  const error = {
    message: 'Unavailable',
    status: 503,
    retryAfterMs: 15_000,
    request: () => {},
  };
  const received = structuredClone(serializeFrameError(error));
  expect(HttpError.fromPossibleFrameSafeError(received)).toMatchObject({
    status: 503,
    retryAfterMs: 15_000,
  });
  expect(received).not.toHaveProperty('request');
});
