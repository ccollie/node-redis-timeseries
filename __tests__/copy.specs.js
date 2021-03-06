const { createClient, insertData } = require('./utils');

// flush
const SOURCE_KEY = 'redis-ts-lex:copy:src';
const DEST_KEY = 'redis-ts-lex:copy:dest';

describe('copy', () => {
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


  function getHash(key = DEST_KEY) {
    return new Promise((resolve, reject) => {
      client.redis.hgetall(key, (err, res) => {
        return err ? reject(err) : resolve(res);
      })
    });
  }

  it('should copy all values', async () => {
    const data = [];

    for (let i = 0; i < samples_count; i++) {
      data.push( (i + 1) * 5 )
    }

    await insertData( client, SOURCE_KEY , start_ts, samples_count, data);
    await client.copy(SOURCE_KEY, DEST_KEY, '-', '+');

    const exists = await client.redis.exists(DEST_KEY);

    expect(exists).toEqual(true);

    let response = await client.range(DEST_KEY, '-', '+');
    const actual = response.map(x => x[1].value);

    expect(actual.length).toEqual(data.length);
    expect(actual[0]).toEqual(data[0]);
    expect(actual[actual.length - 1]).toEqual(data[data.length - 1]);
  });


  describe('options', () => {

    test('filter', async () => {

      const data = [
        {
          id: 1,
          name: "april",
          last_name: 'winters',
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
          name: "leo",
          last_name: 'king'
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
        const src = `${SOURCE_KEY}:${op}`;
        const dest = `${DEST_KEY}:${op}`;

        await insertData(client, src, start_ts, data.length, data);

        if (typeof strFilters === 'string') {
          strFilters = [strFilters]
        }

        const options = { filter: strFilters };
        await client.copy(src, dest, start_ts, start_ts + data.length, options);

        const response = await client.range(dest, start_ts, start_ts + data.length);
        const actual = response.map(x => x[1]);
        const expected = data.filter(predicate);
        try {
          expect(actual).toEqual(expected);
        }
        catch (e) {
          throw new Error(`Filter returns invalid results for operator "${op}" ${JSON.stringify(strFilters)}`, e);
        }
      }

      await checkFilter('equals', 'name=april', (v) => v.name === 'april');
      await checkFilter('greater-than', 'id>2', (v) => v.id > 2);
    });

    test('limit', async () => {
      const data = [];

      for (let i = 0; i < samples_count; i++) {
        data.push( (i + 1) * 5 )
      }

      await insertData(client, SOURCE_KEY , start_ts, samples_count, data);
      const options = {
        limit: {
          offset: 1,
          count: 4
        }
      };
      await client.copy(SOURCE_KEY, DEST_KEY, start_ts, start_ts + samples_count, options);
      const response = await client.range(DEST_KEY, start_ts, start_ts + samples_count);
      const actual = response.map(x => x[1].value);
      expect(actual.length).toEqual(4);
      expect(actual[0]).toEqual(data[1]);
      expect(actual[3]).toEqual(data[4]);
    });

    test('aggregation', async () => {
      const start_ts = 1488823384;
      const samples_count = 1500;

      await insertData(client, SOURCE_KEY, start_ts, samples_count, 5);

      const expected = [[1488823000, 116], [1488823500, 500], [1488824000, 500], [1488824500, 384]];
      const options = {
        aggregation: {
          type: 'count',
          timeBucket: 500
        }
      };
      await client.copy(SOURCE_KEY, DEST_KEY, start_ts, start_ts + samples_count, options);
      const response = await client.range(DEST_KEY, '-', '+');
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

      await insertData(client, SOURCE_KEY, start_ts, data.length, data);
      await client.copy(SOURCE_KEY, DEST_KEY, start_ts, start_ts + data.length, { labels } );

      const response = await client.range(DEST_KEY, start_ts, start_ts + data.length );
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

      await insertData(client, SOURCE_KEY, start_ts, data.length, data);
      await client.copy(SOURCE_KEY, DEST_KEY, start_ts, start_ts + data.length, { redact: labels } );
      const response = await client.range(DEST_KEY, start_ts, start_ts + data.length);

      const actual = response.map(x => x[1]);
      const expected = data.map(user => {
        const data = {...user};
        labels.forEach(label => delete data[label]);
        return data;
      });
      expect(actual).toEqual(expected);

    });

    describe('storage', () => {

      describe('hash', () => {

        test('non-aggregation', async () => {

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

          await insertData(client, SOURCE_KEY, start_ts, data.length, data);
          await client.copy(SOURCE_KEY, DEST_KEY, start_ts, start_ts + data.length, { storage: 'hash' } );

          const response = await getHash(DEST_KEY);
          const actual = Object.keys(response).map(key => JSON.parse(response[key]));
          const expected = data;
          expect(actual).toEqual(expected);

        });

        test('aggregation', async () => {
          const start_ts = 1488823384;
          const samples_count = 1500;

          await insertData(client, SOURCE_KEY, start_ts, samples_count, 5);

          const expected = {
            1488823000: "116",
            1488823500: "500",
            1488824000: "500",
            1488824500: "384"
          };

          const options = {
            aggregation: {
              type: 'count',
              timeBucket: 500
            },
            storage: 'hash'
          };
          await client.copy(SOURCE_KEY, DEST_KEY, start_ts, start_ts + samples_count, options);
          const actual = await getHash(DEST_KEY);
          expect(actual).toEqual(expected);
        })

      });
    });

  });


});
