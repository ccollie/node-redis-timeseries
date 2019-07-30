const {
  createClient,
  insertData
} = require('./utils');

// flush
const TIMESERIES_KEY = 'ts:poprange';

describe('poprange', () => {
  let client;

  const start_ts = 1511885909;
  const samples_count = 50;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  async function pop_range(min, max, options) {
    return client.popRange(TIMESERIES_KEY, min, max, options);
  }


  function insert_data(start_ts, samples_count, value) {
    return insertData(client, TIMESERIES_KEY, start_ts, samples_count, value);
  }

  function get_size() {
    return client.getSize(TIMESERIES_KEY);
  }

  it('should pop and remove data', async () => {

    const data = [];
    for (let i = 0; i < samples_count; i ++) {
      data.push(i);
    }

    await insert_data(start_ts, data.length, data);

    const mid = data.length / 2;
    const mid_ts = start_ts + mid;
    const end_ts = start_ts + data.length;

    let value = await pop_range(mid_ts, end_ts);
    value = value.map(x => parseInt(x[1].value));
    expect(value.length).toEqual(mid);

    const expected = data.slice(mid);
    expect(value).toEqual(expected);

    const remaining = await get_size();
    expect(remaining).toEqual(data.length / 2);
  });


  describe('options', () => {

    it('limit', async () => {
      const data = [];

      for (let i = 0; i < samples_count; i++) {
        data.push( (i + 1) * 5 )
      }

      await insert_data(start_ts, samples_count, data);
      const options = {
        limit: {
          offset: 0,
          count: 4
        }
      };
      let received = await pop_range(start_ts, start_ts + samples_count, options);
      expect(received.length).toEqual(4);
      const actual = received.map(x => x[1].value);
      actual.forEach((val, i) => {
        expect(val).toEqual(data[i]);
      });
    });

    it('filter', async () => {

      const data = [
        {
          id: 1,
          name: "april",
          last_name: 'winters'
        },
        {
          id: 2,
          name: "may",
          last_name: 'summer'
        },
        {
          id: 3,
          name: "june",
          last_name: 'spring'
        },
        {
          id: 4,
          name: "john",
          last_name: 'snow'
        },
        {
          id: 5,
          name: "april",
          last_name: 'black'
        },
        {
          id: 6,
          name: "livia",
          last_name: 'araujo'
        },
      ];

      async function checkFilter(op, strFilters, predicate) {
        await insert_data(start_ts, data.length, data);

        if (typeof strFilters === 'string') {
          strFilters = [strFilters]
        }

        const response = await pop_range(start_ts, start_ts + data.length, {filter: strFilters});
        const actual = response.map(x => x[1]);
        const expected = data.filter(predicate);
        try {
          expect(actual).toEqual(expected);
        }
        catch (e) {
          throw new Error(`Filter returns invalid results for operator "${op}" ${JSON.stringify(strFilters)}`, e);
        }
      }

      await checkFilter('=', 'name=april', (v) => v.name === 'april');
    });

    it('labels', async () => {

      const data = [
        {
          id: 1,
          name: "april",
          last_name: 'winters'
        },
        {
          id: 2,
          name: "may",
          last_name: 'summer'
        },
        {
          id: 3,
          name: "june",
          last_name: 'spring'
        },
        {
          id: 4,
          name: "april",
          last_name: 'black',
        },
        {
          id: 5,
          name: "livia",
          last_name: 'araujo'
        },
      ];

      const labels = ['last_name', 'name'];

      await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

      const response = await pop_range(start_ts, start_ts + data.length, { labels });
      const actual = response.map(x => x[1]);
      const expected = data.map(user => {
        return labels.reduce((res, key) => ({...res, [key]: user[key]}), {});
      });
      expect(actual).toEqual(expected);

    });

    it('redact', async () => {

      const data = [
        {
          id: 1,
          age: 34,
          name: "april",
          last_name: 'winters',
          income: 56000
        },
        {
          id: 2,
          age: 23,
          name: "may",
          income: 120000,
          last_name: 'summer'
        },
        {
          id: 3,
          age: 31,
          name: "june",
          income: 30000,
          last_name: 'spring'
        },
        {
          id: 4,
          age: 54,
          name: "april",
          last_name: 'black',
          income: 210000
        },
        {
          id: 5,
          age: 22,
          name: "livia",
          income: 27500,
          last_name: 'araujo'
        },
      ];

      const labels = ['age', 'income'];

      await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

      const response = await pop_range(start_ts, start_ts + data.length, {redact: labels});
      const actual = response.map(x => x[1]);
      const expected = data.map(user => {
        const data = {...user};
        labels.forEach(label => delete data[label]);
        return data;
      });
      expect(actual).toEqual(expected);

    });
  });

});
