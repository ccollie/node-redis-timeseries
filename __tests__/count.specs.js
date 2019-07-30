const { createClient, addValues } = require('./utils');

const TIMESERIES_KEY = 'ts:count';

describe('count', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });

  it('should return the count of elements between 2 timestamps', async () => {
    await addValues(client, TIMESERIES_KEY, 1000, 10, 2000, 20, 3000, 30, 4000, 40, 5000, 50, 6000, 60);
    const count = await client.count(TIMESERIES_KEY, 2000, 5000);
    expect(count).toEqual(4);
  });

  it('supports special range characters', async () => {
    await addValues( client, TIMESERIES_KEY, 1000, 10, 2000, 20, 3000, 30, 4000, 40, 5000, 50, 6000, 60, 7000, 60);

    let count = await client.count(TIMESERIES_KEY, '-', '+');
    expect(count).toEqual(7);

    count = await client.count(TIMESERIES_KEY, 3000, '+');
    expect(count).toEqual(5);

    count = await client.count(TIMESERIES_KEY, '-', 4000);
    expect(count).toEqual(4);
  });

  it('should support FILTER', async () => {
    await addValues(client, TIMESERIES_KEY, 1000, 10, 2000, 20, 3000, 30, 4000, 40, 5000, 50, 6000, 60);
    const options = {
      filter: "value>30"
    };
    const count = await client.count(TIMESERIES_KEY, 1000, 5000, options);
    expect(count).toEqual(2);
  });

});
