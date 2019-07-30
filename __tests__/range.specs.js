const { createClient, insertData } = require('./utils');
const pAll = require('p-all');


const TIMESERIES_KEY = 'ts-lex:range';

describe('range', () => {
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


  function get_range(min, max, options) {
    return client.range(TIMESERIES_KEY, min, max, options);
  }

  it('should support getting all values', async () => {
    const data = [];

    for (let i = 0; i < samples_count; i++) {
      data.push( (i + 1) * 5 )
    }

    await insertData( client, TIMESERIES_KEY , start_ts, samples_count, data);
    let response = await get_range('-', '+');
    const actual = response.map(x => x[1].value);

    expect(actual.length).toEqual(data.length);
    expect(actual[0]).toEqual(data[0]);
    expect(actual[actual.length - 1]).toEqual(data[data.length - 1]);
  });

  it('should support an offset and count', async () => {
    const data = [];

    for (let i = 0; i < samples_count; i++) {
      data.push( (i + 1) * 5 )
    }

    await insertData(client, TIMESERIES_KEY , start_ts, samples_count, data);
    const options = {
      limit: {
        offset: 1,
        count: 4
      }
    };
    const response = await client.range(TIMESERIES_KEY, start_ts, start_ts + samples_count, options);
    const actual = response.map(x => x[1].value);
    expect(actual.length).toEqual(4);
    expect(actual[0]).toEqual(data[1]);
    expect(actual[3]).toEqual(data[4]);
  });

  it('supports special range syntax', async () => {
    const data = [];
    const start_ts = 1000;

    for (let i = start_ts; i < 10000; i += 1000) {
      data.push( i  )
    }

    const calls = data.map(ts => () => client.add(TIMESERIES_KEY, ts,  {value: ts} ));

    await pAll(calls, { concurrency: 6 });

    const checkRange = async (min, max, expected) => {
      let range = await get_range(min, max);
      const actual = range.map(x => parseInt(x[1].value));
      try {
        expect(actual).toEqual(expected);
      } catch (e) {
        console.log(e);
        throw new Error(`Failed range query with min = ${min} max = ${max}`);
      }
    };


    await checkRange('-', '+', data);
    await checkRange(3000, '+', data.filter(x => x >= 3000));
    await checkRange('-', 4000, data.filter(x => x <= 4000));

    // todo ( and [
  });

  describe('options', () => {

    test('filter', async () => {

      const data = [
        {
          id: 1,
          name: "april",
          last_name: 'winters',
          "class": "middle"
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
          "class": "high"
        },
        {
          id: 5,
          name: "livia",
          last_name: 'araujo',
          "class": "high"
        },
      ];

      async function checkFilter(op, strFilters, predicate) {
        await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

        if (typeof strFilters === 'string') {
          strFilters = [strFilters]
        }

        const options = { filter: strFilters };
        const response = await get_range(start_ts, start_ts + data.length, options);
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
      await checkFilter('>', 'id>2', (v) => v.id > 2);
    });

    test('aggregation', async () => {
      const start_ts = 1488823384;
      const samples_count = 1500;

      await insertData(client, TIMESERIES_KEY, start_ts, samples_count, 5);

      const expected = [[1488823000, 116], [1488823500, 500], [1488824000, 500], [1488824500, 384]];
      const options = {
        aggregation: {
          type: 'count',
          timeBucket: 500
        }
      };
      const response = await get_range(start_ts, start_ts + samples_count, options);
      const actual = response.map(x => [x[0], x[1].value]);
      expect(actual).toEqual(expected);
    });

    test('labels', async () => {

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
          last_name: 'araujo',
        },
      ];

      const labels = ['last_name', 'name'];

      await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

      const response = await client.range(TIMESERIES_KEY, start_ts, start_ts + data.length, { labels } );
      const actual = response.map(x => x[1]);
      const expected = data.map(user => {
        return labels.reduce((res, key) => ({...res, [key]: user[key]}), {});
      });
      expect(actual).toEqual(expected);

    });

    test('redact', async () => {

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

      const response = await client.range(TIMESERIES_KEY, start_ts, start_ts + data.length, { redact: labels });
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
