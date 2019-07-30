const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts:pop';

describe('pop', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });

  function pop(id, options) {
    return client.pop(TIMESERIES_KEY, id, options);
  }

  function add(timestamp, ...values) {
    return client.add(TIMESERIES_KEY, timestamp, ...values);
  }

  function insertData(timestamp, data) {
    let values = data;
    if (typeof data !== 'object') {
      values = ['value', data]
    }
    return add(timestamp, values);
  }

  it('should return the value associated with a timestamp', async () => {
    await add( 1005, 'value', 200);

    const value = await pop( 1005);

    expect(value).toEqual( {value : 200} );
  });

  it('should remove the value from the timeseries', async () => {
    await add(1005, 'first', 1);
    await add( 2005, 'second', 2);
    await add( 3005, 'third', 3);

    await pop( 2005);

    const res = await client.range(TIMESERIES_KEY, '-', '+');
    const values = res.map(x => x[1]);
    const expected = [
      {
        first: 1,
      },
      {
        third: 3
      }
    ];
    expect(values).toEqual(expected);
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

      const received = await pop(1005, {labels: ['active', 'complete']});
      const expected = {
        active: 1,
        complete: 4,
      };

      expect(received).toEqual(expected);
    });


    test('redact', async () => {
      const purchase = {
        cc_number: '134989-9034-1111',
        purchase_amount: 1850,
        user_id: 9073816,
        item: 'Gold Bond Medicated Toe Pads'
      };
      await insertData(1005, purchase);

      const received = await pop(1005, {redact: 'cc_number'} );
      const expected = {
        purchase_amount: 1850,
        user_id: 9073816,
        item: 'Gold Bond Medicated Toe Pads'
      };

      expect(received).toEqual(expected);
    });
  });

});
