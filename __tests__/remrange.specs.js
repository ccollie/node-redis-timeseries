const { createClient, insertData } = require('./utils');

const TIMESERIES_KEY = 'ts:remove_range';

describe('removeRange', () => {
  let client;

  const start_ts = 1488823384;
  const samples_count = 50;


  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  function getSize() {
    return client.getSize(TIMESERIES_KEY);
  }

  async function getSpan() {
    const response = await client.getSpan(TIMESERIES_KEY);
    return [ parseInt(response[0], 10), parseInt(response[1], 10) ]
  }

  it('should remove data based on range', async () => {

    const data = [];
    for (let i = 0; i < samples_count; i ++) {
      data.push(i);
    }

    await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

    const mid = data.length / 2;
    const mid_ts = start_ts + mid;
    const end_ts = start_ts + data.length;

    const count = await client.removeRange(TIMESERIES_KEY, mid_ts, end_ts);

    const remaining = await getSize();
    expect(remaining).toEqual(count);

    const interval = await getSpan();
    expect(interval.length).toEqual(2);
    expect(interval[0]).toEqual(start_ts);
    expect(interval[1]).toEqual(start_ts + mid - 1);

  });

  describe('options', () => {

    it('filter', async () => {

      const data = [];
      for (let i = 0; i < samples_count; i ++) {
        data.push(i);
      }

      await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

      const mid = data.length / 2;
      const mid_ts = start_ts + mid;
      const end_ts = start_ts + data.length;

      const count = await client.removeRange(TIMESERIES_KEY, mid_ts, end_ts, { filter: `value>${mid}` } );
      const expectedCount = data.filter(x => x > mid).length;
      expect(count).toEqual(expectedCount);

      const response = await client.range(TIMESERIES_KEY, '-', '+');
      const actual = response.map(x => parseInt(x[1].value));
      const expected = data.filter(x => x <= mid);

      expect(actual).toEqual(expected);
    });

    it('limit', async () => {

      const data = [];
      for (let i = 0; i < samples_count; i ++) {
        data.push(i);
      }

      await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

      const mid = data.length / 2;
      const mid_ts = start_ts + mid;
      const end_ts = start_ts + data.length;

      const options = {
        limit: {
          offset: 0,
          count: 10
        }
      };
      const count = await client.removeRange(TIMESERIES_KEY, mid_ts, end_ts, options);
      expect(count).toEqual(10);

      const size = await getSize();
      expect(size).toEqual(data.length - count);
    });
  });


});
