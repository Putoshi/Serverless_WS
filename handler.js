'use strict';
process.env.TZ = "Asia/Tokyo";

const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
const LambdaStore = require('./lambdastore');
const Config = require('./config').CONFIG;

/**
 * ソケット接続時
 * @param event
 * @param context
 * @returns {Promise<{statusCode: number}>}
 */
module.exports.connectHandler = async (event, context) => {
  const {
    requestContext: { connectionId, routeKey },
  } = event;

  if (routeKey === "$connect") {
    // handle new connection
    const connectionId = event.requestContext.connectionId;
    // await LambdaStore.create("connectionId",connectionId).then((r) => console.log).catch((e) => console.log);

    // 接続をなめてタイムアウトチェック
    await checkTimeout(event).then((r) => console.log).catch((e) => console.log);

    /**
     * 同一IPを弾く。最大接続数を制限
     * @type {number}
     */
    let connectionCnt = 0;
    let sameIpCnt = 0;
    await LambdaStore.hGetAll("connection").then((r) => {
      connectionCnt = Object.keys(r).length;

      // Same IP Check
      for (let key of Object.keys(r)) {
        let value = JSON.parse(r[key]);
        if(value.ip == event.requestContext.identity.sourceIp) sameIpCnt++;
      }

    }).catch((e) => console.log);

    const client = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
    });

    // 最大コネクション数を制限し、同一IPも弾く
    if(connectionCnt >= Config.MAX_CONNECTION || sameIpCnt >= Config.SAMEIP_CONNECTION) {
      // コネクションを切断

      await client.deleteConnection({
        ConnectionId: connectionId
      }).promise();

      return {
        statusCode: 500
      }
    }

    // Hash型にしてコネクションIDを保存
    const userData = {
      id: connectionId,
      type: 'subscriber',
      ip: event.requestContext.identity.sourceIp,
      connectedAt: event.requestContext.connectedAt
    };

    await LambdaStore.hcreate("connection", `user:${connectionId}`, JSON.stringify(userData)).then((r) => console.log).catch((e) => console.log);

    return {
      statusCode: 200
    }
  }
}

/**
 * ソケット切断時
 * @param event
 * @param context
 * @returns {Promise<{statusCode: number}>}
 */
module.exports.disconnectHandler = async (event, context) => {
  const {
    requestContext: { connectionId, routeKey },
  } = event;

  if (routeKey === "$disconnect") {

    // コネクションデータの削除
    await LambdaStore.hclear('connection', `user:${event.requestContext.connectionId}`).then((r) => console.log).catch((e) => console.log);

    return {
      statusCode: 200
    }
  }
}

/**
 * データの受け口
 * @param event
 * @param context
 * @returns {Promise<{statusCode: number}>}
 */
module.exports.publishDataHandler = async (event, context) => {
  const routeKey = JSON.parse(event.body).action;
  const type = JSON.parse(event.body).type;
  const data = JSON.parse(event.body).data;


  if(routeKey === 'publishdata'){

    let connections = await getConnections();
    const client = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
    });

    // データ供給者の初期化
    if(type === 'init') {

      // publisherが参加した際に接続者に通知する
      for (let key of Object.keys(connections)) {
        let value = JSON.parse(connections[key]);


        // 接続ユーザーのtype書き換え
        if(event.requestContext.connectionId === value.id) {
          let userData = await getUserData(event.requestContext.connectionId);
          userData.type = 'publisher';

          // コネクションデータのpublisher書き換え
          await LambdaStore.hcreate("connection", `user:${event.requestContext.connectionId}`, JSON.stringify(userData)).then((r) => console.log).catch((e) => console.log);
        }

        await client
          .postToConnection({
            ConnectionId: value.id,
            Data: JSON.stringify({
              type: 'status',
              data: {
                newConnection: event.requestContext.connectionId,
                yourId: value.id,
                connectionsCnt: Object.keys(connections).length
              }
            })
          })
          .promise();
      }


      // let cnt = 0;
      // await LambdaStore.hGetAll("connection").then((r) => {
      //   cnt = Object.keys(r).length;
      // }).catch((e) => console.log);
    }


    // データ供給
    else if(type === 'publish') {

      for (let key of Object.keys(connections)) {
        let value = JSON.parse(connections[key]);
        if(value.type == 'subscriber') {
          await client
            .postToConnection({
              ConnectionId: value.id,
              Data: JSON.stringify({
                type: 'sub',
                userId: event.requestContext.connectionId,
                data: data
              })
            })
            .promise();

        }

      }
    }
  }

  // handle sendmessage
  return {
    statusCode: 200
  }
}

/**
 * デフォルトイベント(何にも該当しない場合は切断)
 * @param event
 * @param context
 * @returns {Promise<{statusCode: number}>}
 */
module.exports.defaultHandler = async (event, context) => {

  // コネクションデータの削除
  LambdaStore.hclear('connection', `user:${event.requestContext.connectionId}`).then((r) => console.log).catch((e) => console.log);

  const client = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  });

  // await client
  //   .postToConnection({
  //     ConnectionId: event.requestContext.connectionId,
  //     Data: `Bye! ${event.requestContext.connectionId}`,
  //   })
  //   .promise();

  // コネクションを切断
  await client.deleteConnection({ ConnectionId: event.requestContext.connectionId }).promise();

  return {
    statusCode: 200,
  };
}

/**
 * 接続者の取得
 * @returns {Promise<*>}
 */
async function getConnections(){
  return await LambdaStore.hGetAll("connection").then((r) => {
    return new Promise(resolve => {
      resolve(r);
    });
  }).catch((e) => {
    return new Promise((resolve, reject) => {
      reject(e);
    });
  });
};

async function getUserData(id){
  return await LambdaStore.hFindOne("connection", `user:${id}`).then((r) => {
    return new Promise(resolve => {
      resolve(JSON.parse(r));
    });
  }).catch((e) => {
    return new Promise((resolve, reject) => {
      reject(e);
    });
  });
};


/**
 * 接続タイムアウト
 * @param event
 * @returns {Promise<*>}
 */
async function checkTimeout(event){
  const Config = require('./config').CONFIG;
  return await LambdaStore.hGetAll("connection").then((r) => {
    return new Promise(resolve => {

      let deleteIds = [];
      for (let key of Object.keys(r)) {
        let value = JSON.parse(r[key]);
        let dstHour = (new Date().getTime() - value.connectedAt) / (1000 * 3600);

        // タイムアウト時間を超えているか確認
        if(dstHour > Config.TIMEOUT_HOUR) {
        // if(dstHour > Config.TIMEOUT_HOUR && value.type === 'publisher') {

          deleteIds.push(value.id);

          // コネクションデータの削除
          LambdaStore.hclear('connection', `user:${value.id}`).then((r) => console.log).catch((e) => console.log);
        }
      }

      resolve(deleteIds);
    });
  }).catch((e) => {
    return new Promise((resolve, reject) => {
      reject(e);
    });
  });
}
