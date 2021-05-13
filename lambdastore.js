'use strict';

const Promise = require('bluebird');
const Redis = require('ioredis');
const LambdaStoreConfig = require('./config').LAMBDASTORE;

const redis = new Redis({
  port: LambdaStoreConfig.PORT,
  host: LambdaStoreConfig.HOST,
  password: LambdaStoreConfig.PASSWORD,
  db: 0
});

exports.create = function(key,value) {

  console.log('Init create Key');
  return new Promise((resolve, reject) => {
    redis.set(key, value)
      .then((result) => {
        console.log("Result from create ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from create ", err);
        reject(err);
      });
  });
};

exports.findOne = function(key) {
  if(!key) {
    console.log("Key not exists");
    throw "Key not exists";
  }

  console.log('Init find Key');
  return new Promise((resolve, reject) => {
    redis.get(key)
      .then((result) => {
        console.log("Read ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from read ", err);
        reject(err);
      });
  });
};


exports.update = async function(key,value) {

  console.log('Init update');

  await this.findOne(key).then((r) => {
    return new Promise((resolve, reject) => {

      // let dataSet = Object.assign(r, value);
      // console.log(JSON.stringify(dataSet));
      return redis.set(key, value)
        .tap((result) => {
          console.log("Result from update ", result);
          resolve(r);
        })
        .catchThrow((err) => {
          console.log("Error from update ", err);
          reject(err);
        });
    });
  }).catch((e) => {
    return new Promise((resolve, reject) => {
      reject(e);
    });
  });
};

exports.remove = function(key) {
  if(!key) {
    console.log("Key not exists");
    throw "Key not exists";
  }

  return new Promise((resolve, reject) => {
    redis.del(key)
      .then((result) => {
        console.log("Remove item: ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from remove item ", err);
        reject(err)
      });
  })
};

exports.hcreate = (hashKey, key, value) => {
  console.log('Init create Hash Key');
  return new Promise((resolve, reject) => {
    redis.hset(hashKey, key, value)
      .then((result) => {
        console.log("Result from create ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from create ", err);
        reject(err);
      });
  });
};

exports.hFindOne = (hashKey, key) => {
  if(!hashKey) {
    console.log("hashKey not exists");
    throw "hashKey not exists";
  }

  if(!key) {
    console.log("Key not exists");
    throw "Key not exists";
  }

  console.log('Init find Key');
  return new Promise((resolve, reject) => {
    redis.hget(hashKey, key)
      .then((result) => {
        // result = JSON.parse(result);
        console.log("Read ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from read ", err);
        reject(err);
      });
  });
};


exports.hGetAll = (hashKey) => {
  if(!hashKey) {
    console.log("hashKey not exists");
    throw "hashKey not exists";
  }

  return new Promise((resolve, reject) => {
    redis.hgetall(hashKey)
      .then((result) => {
        // result = JSON.parse(result);
        // console.log("Read ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from read ", err);
        reject(err);
      });
  });
};

exports.hclear = (hashKey, key) => {
  if(!hashKey) {
    console.log("HashKey not exists");
    throw "HashKey not exists";
  }

  if(!key) {
    console.log("Key not exists");
    throw "Key not exists";
  }

  return new Promise((resolve, reject) => {
    redis.hdel(hashKey, key)
      .then((result) => {
        console.log("Remove item: ", result);
        resolve(result);
      })
      .catch((err) => {
        console.log("Error from remove item ", err);
        reject(err)
      });
  })
};

exports.close = function(key) {
  return new Promise((resolve, reject) => {
    redis.quit(()=>{
      resolve();
    });

  })
};
