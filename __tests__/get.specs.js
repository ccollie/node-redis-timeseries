const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts:get';

describe('get', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  function insertData(timestamp, data) {
    let values = data;
    if (typeof data == 'object') {
      values = data;
    } else {
      values = {value: data}
    }
    return client.add(TIMESERIES_KEY, timestamp, values);
  }

  function getValue(timestamp, options) {
    return client.getValue(TIMESERIES_KEY, timestamp, options);
  }

  it('should return the value associated with a timestamp', async () => {
    await insertData(1005, 200);

    const value = await getValue(1005);

    expect(value).toEqual({'value': 200});
  });

  it('should return all values if no keys are specified', async () => {
    const states = {
      active: 1,
      waiting: 2,
      error: 3,
      complete: 4
    };
    await insertData(1005, states);

    const received = await getValue(1005);

    expect(received).toEqual(states);
  });

  describe('options', () => {
    test('labels', async () => {
      const states = {
        active: 1,
        waiting: 2,
        error: 3,
        complete: 4
      };
      await insertData(1005, states);

      const received = await getValue(1005, {labels: ['active', 'complete']});
      const expected = {
        active: 1,
        complete: 4,
      };

      expect(received).toEqual(expected);
    });


    test('redact', async () => {
      const states = {
        active: 1,
        waiting: 2,
        error: 3,
        complete: 4
      };
      await insertData(1005, states);

      const received = await getValue(1005, {redact: ['active', 'complete']});
      const expected = {
        waiting: 2,
        error: 3,
      };

      expect(received).toEqual(expected);
    });
  });

});
