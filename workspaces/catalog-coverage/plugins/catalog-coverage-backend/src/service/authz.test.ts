import { Request, Response } from 'express';
import { createOwnerGuard } from './authz';

/** Minimal express res double capturing status + json. */
const makeRes = () => {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = ((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as Response['status'];
  res.json = ((payload: unknown) => {
    res.body = payload;
    return res as Response;
  }) as Response['json'];
  return res as Response & { statusCode?: number; body?: unknown };
};

const makeReq = (owner: string): Request =>
  ({ params: { owner } } as unknown as Request);

describe('createOwnerGuard', () => {
  it('rejects all mutations with 403 when the allowlist is empty (fail-closed)', () => {
    const guard = createOwnerGuard([]);
    const res = makeRes();
    const next = jest.fn();

    guard(makeReq('zentala'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toMatch(/no allowed owners/i);
  });

  it('rejects an owner not on the allowlist with 403', () => {
    const guard = createOwnerGuard(['zentala']);
    const res = makeRes();
    const next = jest.fn();

    guard(makeReq('attacker'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toMatch(/not in the/i);
  });

  it('allows an owner on the allowlist and calls next()', () => {
    const guard = createOwnerGuard(['zentala', 'acme']);
    const res = makeRes();
    const next = jest.fn();

    guard(makeReq('acme'), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });

  it('matches owners case-insensitively', () => {
    const guard = createOwnerGuard(['Zentala']);
    const res = makeRes();
    const next = jest.fn();

    guard(makeReq('zentala'), res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
