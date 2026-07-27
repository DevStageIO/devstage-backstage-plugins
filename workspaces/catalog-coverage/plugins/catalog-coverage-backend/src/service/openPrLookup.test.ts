/** Tests for the TTL-memoised open onboarding PR lookup. */

import { createOpenPrLookup, ONBOARD_BRANCH } from './openPrLookup';

const PR_URL = 'https://github.com/acme/widget/pull/7';

const okResponse = (body: unknown) =>
  ({ ok: true, json: async () => body } as unknown as Response);

describe('createOpenPrLookup', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(okResponse([{ html_url: PR_URL }]));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns the first open onboarding PR url', async () => {
    const lookup = createOpenPrLookup();

    await expect(lookup.findOpenOnboardingPr('acme', 'widget')).resolves.toBe(
      PR_URL,
    );
    expect(fetchMock.mock.calls[0][0]).toContain(
      `head=acme:${ONBOARD_BRANCH}&state=open`,
    );
  });

  it('issues one request for repeated lookups inside the TTL', async () => {
    const lookup = createOpenPrLookup({ now: () => 1000, ttlMs: 60_000 });

    await lookup.findOpenOnboardingPr('acme', 'widget');
    await lookup.findOpenOnboardingPr('acme', 'widget');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the TTL has elapsed', async () => {
    let clock = 1000;
    const lookup = createOpenPrLookup({ now: () => clock, ttlMs: 60_000 });

    await lookup.findOpenOnboardingPr('acme', 'widget');
    clock += 60_001;
    await lookup.findOpenOnboardingPr('acme', 'widget');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent lookups for the same repo into one request', async () => {
    const lookup = createOpenPrLookup();

    await Promise.all([
      lookup.findOpenOnboardingPr('acme', 'widget'),
      lookup.findOpenOnboardingPr('acme', 'widget'),
      lookup.findOpenOnboardingPr('acme', 'widget'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not share cache entries between different repos', async () => {
    const lookup = createOpenPrLookup();

    await lookup.findOpenOnboardingPr('acme', 'widget');
    await lookup.findOpenOnboardingPr('acme', 'gadget');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resolves undefined when there is no open PR', async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    await expect(
      createOpenPrLookup().findOpenOnboardingPr('acme', 'widget'),
    ).resolves.toBeUndefined();
  });

  it('resolves undefined instead of rejecting when GitHub errors', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      createOpenPrLookup().findOpenOnboardingPr('acme', 'widget'),
    ).resolves.toBeUndefined();
  });

  it('resolves undefined on a non-OK response', async () => {
    fetchMock.mockResolvedValue({ ok: false } as unknown as Response);

    await expect(
      createOpenPrLookup().findOpenOnboardingPr('acme', 'widget'),
    ).resolves.toBeUndefined();
  });

  it('sends the token as a bearer credential when provided', async () => {
    await createOpenPrLookup({ githubToken: 'tkn' }).findOpenOnboardingPr(
      'acme',
      'widget',
    );

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer tkn');
  });
});
