const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts:exists';

describe('exists', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  it('should return true if the timestamp exists', async () => {
    await client.add(TIMESERIES_KEY, 1005, 'name', 'alice');

    const exists = await client.exists(TIMESERIES_KEY, 1005);

    expect(exists).toBe(true);
  });

  it('should NOT return true for a non-existent timestamp', async () => {
    await client.add(TIMESERIES_KEY, 1005, 'Number', 6789, 'letter', 'a');

    const exists = await client.exists(TIMESERIES_KEY, 9999);

    expect(exists).toBe(false);
  });

});
