const { initClient, exec, execMulti } = require('./scripts');
const {
  parseMessageResponse,
  parseObjectResponse,
  parseOptions,
  parseKeyValueList,
  parseTs,
  isString
} = require('./utils');

const TIMESERIES_SCRIPT_NAME = 'timeseries-lex';

class TimeSeriesClient {
  constructor (redis, lib) {
    this.redis = redis;
    this._opts = lib;
    this._multi = null;
    initClient(redis, this.ready())
  }

  add(key, ts, ...data) {
    const values = parseKeyValueList(data);
    return this._call('add', key, parseTs(ts), ...values);
  }

  set(key, ts, ...data) {
    const values = parseKeyValueList(data);
    return this._call('set', key, parseTs(ts), ...values);
  }

  del(key, ...ts) {
    const timestamps = [].concat(...ts).map(parseTs);
    return this._call('del', key, ...timestamps);
  }

  _getValue(cmd, key, ts, options = {}) {
    const { redact, labels, format } = options;
    const params = parseOptions({ redact, labels, format });
    if (this._multi) {
      return this._call(cmd, key, parseTs(ts), ...params);
    } else {
      return this._call(cmd, key, parseTs(ts), ...params)
          .then((response) => isString(response) ? JSON.parse(response) : parseObjectResponse(response));
    }
  }

  getValue(key, ts, options = {}) {
    return this._getValue('get', key, ts, options);
  }

  pop(key, ts, options = {}) {
    return this._getValue('pop', key, ts, options);
  }

  exists(key, ts) {
    return this._call('exists', key, ts).then(response => !!response);
  }

  getSize(key) {
    return this._call('size', key);
  }

  getSpan(key) {
    return this._call('span', key);
  }

  incrBy(key, timestamp, ...vals) {
    const values = parseKeyValueList(vals);
    return this._call('incrBy', key, timestamp, ...values);
  }

  count(key, min, max, opts = {}) {
    const {filter} = opts;
    const params = parseOptions({filter});
    return this._call('count', key, parseTs(min), parseTs(max), ...params);
  }

  _getRangeEx(cmd, key, min, max, options = {}) {
    const args = parseOptions(options);
    min = parseTs(min);
    max = parseTs(max);
    if (this._multi) {
      return this._call(cmd, key, min, max, ...args);
    }
    return this._call(cmd, key, min, max, ...args).then(parseMessageResponse);
  }

  range(key, min, max, options) {
    return this._getRangeEx('range', key, min, max, options);
  }

  revRange(key, min, max, options) {
    return this._getRangeEx('revrange', key, min, max, options);
  }

  popRange(key, min, max, options) {
    return this._getRangeEx('poprange', key, min, max, options);
  }

  removeRange(key, min, max, options = {}) {
    const { limit, filter } = options;
    const args = parseOptions({ filter, limit });
    return this._call('remrange', key, min, max, ...args);
  }

  times(key, min = '-', max = '+') {
    return this._call('times', key, min, max);
  }

  copy(src, dest, min = '-', max = '+', options = {}) {
    const { storage = 'timeseries' } = options;
    const args = ['copy', parseTs(min), parseTs(max), ...parseOptions(options), 'STORAGE', storage];
    if (this._multi) {
      execMulti(this._multi, TIMESERIES_SCRIPT_NAME, [src, dest], args);
      return this;
    }
    return exec(this.redis, TIMESERIES_SCRIPT_NAME, [src, dest], args);
  }

  _call(command, key, ...args) {
    args = [command, ...args];
    if (this._multi) {
      execMulti(this._multi, TIMESERIES_SCRIPT_NAME, [key], args);
      return this;
    }
    return exec(this.redis, TIMESERIES_SCRIPT_NAME, [key], args);
  }

  multi(multi = null) {
    this._multi = multi || this.redis.multi();
    return this;
  }

  get pendingMulti() {
    return this._multi;
  }

  exec() {
    if (!this._multi) {
      return Promise.resolve([]);
    }
    const multi = this._multi;
    this._multi = null;
    return new Promise((resolve, reject) => {
      multi.exec((err, res) => {
        return err ? reject(err) : resolve(res);
      })
    });
  }

  /**
   * Waits for a redis client to be ready.
   * @param {Redis} redis client
   */
  ready() {
    return new Promise((resolve, reject) => {
      if (this._opts.isClientReady(this.redis)) {
        return resolve(this);
      }

      let handleReady;

      const handleError = (err) => {
        this.redis.removeListener('ready', handleReady);
        reject(err);
      };

      handleReady = () => {
        this.redis.removeListener('error', handleError);
        resolve(this);
      };

      this.redis.once('ready', handleReady);
      this.redis.once('error', handleError);
    });
  }

}


module.exports = TimeSeriesClient;