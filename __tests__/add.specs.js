const { createClient } = require('./utils');

const TIMESERIES_KEY = 'ts:add';

describe('add', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  function add(ts, value) {
    if (typeof (value) !== 'object') {
      value = { value }
    }
    return client.add(TIMESERIES_KEY, ts, value);
  }

  it('should add a value to the set', async () => {
    const data = { beers: 30 };
    await add( 3000, data ) ;

    const size = await client.getSize(TIMESERIES_KEY);
    expect(size).toEqual(1);

    const response = await client.getValue(TIMESERIES_KEY, 3000);

    expect(response).toEqual(data);
  });


  it('should allow arbitrary data to be associated with a timestamp', async () => {

    const data = {
      bool: true,
      int: 12345,
      string: "bazinga",
      float: 123.456
    };
    await add(1000, data);

    const response = await client.getValue(TIMESERIES_KEY, 1000);

    // necessary because redis doesnt return float values from Lua, and nil values in a table
    const expected = { ...data, bool: 1, float: data.float.toString()};

    expect(response).toEqual(expected);
  });

  it('should disallow duplicate values', async () => {
    await add( 1000, 20);
    await add( 1000, 20);
    const count = await client.redis.zlexcount(TIMESERIES_KEY, '-', '+');
    expect(count).toEqual(1);
  });

  it('should throw on mismatched key/value count', async () => {
    await client.add(TIMESERIES_KEY, 1000, "last_name")
        .catch(e => expect(e.message).toMatch(/Key-value pairs mismatched/));
  });

});
