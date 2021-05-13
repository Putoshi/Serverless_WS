# ServerLess WebSocket Broker
using API GATEWAY + AWS Lambda + LambdaStore

## Create Project

serverless create --template aws-nodejs --name serverless-websocket --path serverless-websocket

## Build
sls deploy

## Clear
serverless remove -v


## Test Command

### connect
```$wscat -c wss://xxxxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/develop```

### データ送る側として参加

##### ```> { "action": "publishdata", "type":"init", "data": "" }```

### データを送る
```> { "action": "publishdata", "type":"publish", "data": "test" }```

