const pAll = require('p-all');
const { createClient: createTSClient } = require('../index');


function createClient(clientLib = 'redis') {
  const url = '//' + (process.env.REDIS_URL || 'localhost:6379');
  const clientModule = (process.env.CLIENT_LIB || 'redis');
  const module = require(clientModule === 'node_redis' ? 'redis' : clientModule);
  const redis = module.createClient(url);   // todo - specify db ????
  const client = createTSClient(redis, clientLib);
  return client.ready();
}

/***
 * insert data to key, starting from start_ts, with 1 sec interval between them
 * @param client redis client
 * @param key name of the time series
 * @param start_ts  beginning timestamp ot the time series
 * @param samples_count the number of samples
 * @param data could be a list of samples_count values, or one value. if a list, insert the values in their
 *              order, if not, insert the single value for all the timestamps
 * @returns {Promise<[any]>}
 */
function insertData(client, key, start_ts, samples_count, data) {
  const calls = [];
  for (let i = 0; i < samples_count; i++) {
    let value = Array.isArray(data) ? data[i] : data;
    if (typeof(value) == 'object') {
      calls.push( () => client.add(key, start_ts + i, value) )
    } else {
      calls.push( () => client.add(key, start_ts + i, 'value', value) )
    }
  }
  return pAll(calls, { concurrency: 8 });
}

async function addValues(client, key, ...args) {
  const values = [].concat(...args);
  const calls = [];
  for (let i = 0; i < values.length; i += 2) {
    const ts = values[i];
    const val = values[i+1];
    const call = () => client.add(key, ts, 'value', val);
    calls.push(call);
  }

  return pAll(calls, { concurrency: 16 });
}


module.exports = {
  createClient,
  insertData,
  addValues,
};