import { GetMeService } from './get-me.service';

describe('GetMeService', () => {
  it('returns the session user without the session id', () => {
    const service = new GetMeService();

    expect(
      service.execute({
        id: 'user-1',
        email: 'a@example.com',
        name: 'Ada',
        sessionId: 'session-1',
      }),
    ).toEqual({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Ada',
    });
  });
});
