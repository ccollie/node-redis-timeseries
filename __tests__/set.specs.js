const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts:set';

describe('set', () => {
  const start_ts = 1511885909;
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  function getValue(timestamp) {
    return client.getValue(TIMESERIES_KEY, timestamp);
  }

  function set(timestamp, valueHash) {
    const res = client.set(TIMESERIES_KEY, timestamp, valueHash);
    return res;
  }

  function add(ts, value) {
    if (typeof (value) !== 'object') {
      value = { value }
    }
    return client.add(TIMESERIES_KEY, ts, value);
  }

  it('should create the value if it does not exist' , async () => {

    const data = {
      active: 1,
      waiting: 2,
    };

    await set(start_ts, data);
    const actual = await getValue(start_ts);
    expect(actual).toEqual(data);
  });


  it('should set the values' , async () => {

    const data = {
      active: 1,
      waiting: 2,
      completed: 3,
      failed: 4,
    };

    const newValues  = {
      active:  4,
      waiting: 3,
      completed: 2,
      failed: 1
    };

    await add(start_ts, data);

    await set(start_ts, newValues);

    const actual = await getValue(start_ts);
    expect(actual).toEqual(newValues);

  });

});
