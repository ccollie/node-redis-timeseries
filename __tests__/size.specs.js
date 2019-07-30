const pAll = require("p-all");
const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts-test:size';

describe('size', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });

  async function addValues(...args) {
    const values = [].concat(...args);
    const calls = [];
    for (let i = 0; i < values.length; i += 2) {
      const ts = values[i];
      const val = values[i+1];
      const call = () => client.add(TIMESERIES_KEY, ts, 'value', val);
      calls.push(call);
    }

    return pAll(calls, { concurrency: 16 });
  }


  it('should return the correct list size', async () => {
    let size = await client.getSize(TIMESERIES_KEY);
    expect(size).toEqual(0);

    await addValues(1005, 200);
    await addValues(1000, 10, 2000, 20, 3000, 30);
    size = await client.getSize(TIMESERIES_KEY);
    expect(size).toBe(4);
  });

});
