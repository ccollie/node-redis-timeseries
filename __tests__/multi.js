const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts:multi';

describe('multi', () => {
  let client, multi;

  const start_ts = 1488823384;

  beforeEach(async () => {
    client = await createClient();
    multi = client.multi();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });

  it('should function', async () => {
    client.multi();

    for (let i = 0; i < 5; i++) {
      client.add(TIMESERIES_KEY, start_ts + i, 'value', ((i+1) * 5));
    }

    client.pop(TIMESERIES_KEY, start_ts);
    client.range(TIMESERIES_KEY, '-', '+');

    const responses = await client.exec();

    expect(responses.length).toEqual(7);
    expect(responses[0]).toEqual(start_ts.toString());

    const popped = responses[5];
    expect(popped).toEqual(['value', 5]);

    const last = responses[responses.length - 1];
    expect(last.length).toEqual(4);
  });

  it('should return the client from calls', async () => {

    client.multi();

    let res = client.add(TIMESERIES_KEY, '*', 'hello', 10);
    expect(res).toEqual(client);

    res = client.getValue(TIMESERIES_KEY, '*');
    expect(res).toEqual(client);

    res = client.range(TIMESERIES_KEY, '-', '+');
    expect(res).toEqual(client);

  });

});
