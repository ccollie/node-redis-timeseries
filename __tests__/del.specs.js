
const { createClient, insertData } = require('./utils');

const TIMESERIES_KEY = 'node-redis-timeseries-lex:del';

describe('del', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });

  it('should add a delete a value from the set', async () => {
    const id = await client.add(TIMESERIES_KEY, 1000, "beers", 30);
    const count = await client.del(TIMESERIES_KEY, id);
    expect(count).toEqual(1);
  });


  it('should allow a variable amount of keys', async () => {
    const start_ts = 1488823384;
    const samples_count = 20;

    const data = [];

    for (let i = 0; i < samples_count; i++) {
      data.push( i );
    }

    await insertData(client, TIMESERIES_KEY, start_ts, samples_count, data);
    const items = await client.range(TIMESERIES_KEY, '-', '+');
    const ids = items.map(x => x[0]);

    const count = await client.del(TIMESERIES_KEY, ids);
    expect(count).toEqual(ids.length);

  });

});
