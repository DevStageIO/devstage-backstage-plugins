import { buildDevApp } from './devApp';

describe('dev harness', () => {
  // The harness is the only place the plugin is exercised without the portal,
  // so a wiring break here is a break for every consumer — but it is not
  // imported by any other test, and would otherwise fail for the first time
  // in someone's terminal.
  it('assembles without throwing', () => {
    expect(() => buildDevApp()).not.toThrow();
  });

  it('produces a renderable root', () => {
    expect(typeof buildDevApp().render).toBe('function');
  });
});
