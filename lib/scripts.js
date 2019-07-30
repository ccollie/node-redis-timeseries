const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const debug = require('debug')('redis-timeseries-lex');

let scripts = {};


function sha1(string) {
  return crypto.createHash('sha1').update(string, 'utf8').digest('hex');
}

function loadFromFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const sha = sha1(content);
  return {
    path: filepath,
    content,
    sha
  }
}

function loadScriptsFromDir(scriptsDir) {

  const names = fs.readdirSync(scriptsDir).filter(file => file.endsWith('.lua'));
  const scripts = {};

  names.forEach(name => {
    const filename = path.resolve(scriptsDir, name);
    const key = name.replace('.lua', '');

    scripts[key] = loadFromFile(filename);
    scripts[key].key = key; // :-)
  });


  return scripts;
}

function loadScriptsIntoRedis(client, scripts, callback) {

  let cnt = 0;
  const keys = Object.keys(scripts);

  (function doLoad() {

    if (cnt < keys.length) {
      const key = keys[cnt++];
      const script = scripts[key].content;

      client.script('load', script, (err, sha) => {

        if (err) {
          callback(err);
        } else {
          scripts[key].sha = sha;
          doLoad();
        }

      });
    } else {
      callback(null, scripts);
    }
  })();
}

const USER_SCRIPT_RE = /user_script:\d+:\s*(\w+.+$)/;

function parseScriptError(message) {
  let match = USER_SCRIPT_RE.exec(message);
  if (match) {
    match = match[1].replace(/user_script:\d+:\s*/, '');
    return match;
  }

  return null;
}

function exec(client, name, keys, args) {

  const scriptArgs = [keys.length, ...keys, ...args];

  function evalScript(script, resolve, reject) {
    const params = [script, ...scriptArgs];
    client.eval(...params, (err, res) => {
      return err ? reject(err) : resolve(res);
    });
  }

  return new Promise((resolve, reject) => {
    const script = scripts[name];

    if (!script) {
      return reject(new Error(`Script "${name}" not found.`));
    }
    if (script.sha) {
      const params = [script.sha, ...scriptArgs];
      client.evalsha(...params, (err, res) => {
        if (!err) return resolve(res);

        if (/NOSCRIPT/.test(err.message)) {
          return evalScript(script.content, resolve, reject);
        } else {
          err.message = parseScriptError(err.message);
          return reject(err);
        }
      });
    } else {
      return evalScript(script.content, resolve, reject);
    }

  });
}

function execMulti(client, name, keys, args) {

  const script = scripts[name];
  if (!script) {
    throw new Error(`Script "${name}" not found.`);
  }
  const scriptArgs = [keys.length, ...keys, ...args];
  if (script.sha) {
    const params = [script.sha, ...scriptArgs];
    client.evalsha(...params)
  } else {
    const params = [script, ...scriptArgs];
    client.eval(...params);
  }

}

function init() {
  if (!Object.keys(scripts).length) {
    const scriptDirs = [
       // __dirname,
       path.resolve('../redis-timeseries-lex')
    ];

    scripts = scriptDirs.reduce((res, dir) => {
      let scripts = loadScriptsFromDir(dir);
      return {...res, ...scripts};
    }, {});

  }
}


function initClient(client, readyPromise) {

  init();

  let isLoaded = false;

  function handleLoad() {
    if (isLoaded) return;

    debug('loading scripts into redis again, after-reconnect');
    loadScriptsIntoRedis(client, scripts, (err, res) => {
      isLoaded = !!res;
    });
  }

  readyPromise.then(handleLoad);

  //load scripts into redis in every time it connects to it
  client.on('connect', handleLoad);

  //reset shas after error occurred
  client.on('error', (err) => {
    const errorMessage = (err) ? err.toString() : "";
    debug(`redis connection error: ${errorMessage}`);
    isLoaded = false;
  });
}

module.exports = {
  initClient,
  exec,
  execMulti
};

