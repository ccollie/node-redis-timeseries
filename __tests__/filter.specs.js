const { createClient, insertData } = require('./utils');

const TIMESERIES_KEY = 'ts:filter';

describe('filter', () => {
  let client;

  beforeEach(async () => {
    client = await createClient();
    return client.redis.flushdb();
  });

  afterEach(() => {
    return client.redis.quit();
  });


  const start_ts = 1488823384;

  async function checkFilter(data, op, filters, predicate) {
    const key = `${TIMESERIES_KEY}:${op}`;

    await insertData(client, key, start_ts, data.length, data);

    if (typeof filters === 'string') {
      filters = [filters]
    }

    const options = {
      filter: filters
    };
    let response = await client.range(key, start_ts, start_ts + data.length, options);

    const actual = response.map(x => x[1]);
    const expected = data.filter(predicate);
    try {
      expect(actual).toEqual(expected);
    }
    catch (e) {
      console.log(e);
      throw new Error(`Filter returns invalid results for operator "${op}" ${JSON.stringify(filters)}`);
    }
  }

  const data = [
    {
      id: 1,
      name: "april",
      last_name: 'winters',
    },
    {
      id: 2,
      name: "may",
      last_name: 'summer',
    },
    {
      id: 3,
      name: "june",
      last_name: 'spring',
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

  it('parses properly in the non-terminal position', async () => {
    await insertData(client, TIMESERIES_KEY, start_ts, data.length, data);

    const filters = ["name=april", "OR", "name=may", 'AND', 'id>=2'];
    const predicate = (x) => (x.name === 'april' || x.name === 'may') && x.id>=2;
    const options = {
      filter: filters,
      redact: 'id'
    };
    let response = await client.range(TIMESERIES_KEY, start_ts, start_ts + data.length, options);

    const actual = response.map(x => x[1]);
    const expected = data.filter(predicate);
    expect(actual.length).toEqual(expected.length);
  });

  it('Equals', async () => {
    await checkFilter(data, '=', 'name=april', (v) => v.name === 'april');
  });

  it('Not Equals', async () => {
    await checkFilter(data,  '!=', 'name!=april', (v) => v.name !== 'april');
  });

  it('Greater Than', async () => {
    await checkFilter(data,  '>', 'id>2', (v) => v.id > 2);
  });

  it('Less Than', async () => {
    await checkFilter(data,  '<', 'id<3', (v) => v.id < 3);
  });

  test('Greater Or Equal', async () => {
    await checkFilter(data,  '>=', 'name>=livia', (v) => v.name >= 'livia');
  });

  test('Less Than Or Equal', async () => {
    await checkFilter(data,  '<=', 'last_name<=summer', (v) => v.last_name <= 'summer');
  });

  test('Contains', async () => {
    await checkFilter(data,  'contains', 'id=(1,3,5)', (v) => [1,3,5].includes(v.id));
  });

  test('Not Contains', async () => {
    await checkFilter(data,  '!contains', 'last_name!=(black,summer)', (v) => !['black','summer'].includes(v.last_name));
  });

  test('OR', async () => {
    const filters = ["name=april", "OR", "name=may"];
    const predicate = (x) => x.name === 'april' || x.name === 'may';
    await checkFilter(data,  'OR', filters, predicate);
  });

  test('Multiple join operations', async () => {
    const filters = ["name=april", "OR", "name=may", 'AND', 'id>=2'];
    const predicate = (x) => (x.name === 'april' || x.name === 'may') && x.id>=2;
    await checkFilter(data,  'OR and AND', filters, predicate);
  });

});
