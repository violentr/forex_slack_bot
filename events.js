const AWS = require("aws-sdk");
console.log("AWS loaded!");
const getSlackEvent = (event) => ({ slack: JSON.parse(event.body) })

const lambda = new AWS.Lambda();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const getTeam = (event) => {
  console.log("Event", event)
  const params = {
    TableName: process.env.TEAMS_TABLE,
    Key: {team_id: event.slack.team_id,},
  };
  console.log('dynamodb.get', params);
  return dynamodb.get(params).promise()
    .then(data => Object.assign(event, {team: data.Item}));
};

const respond = callback => (event) => {
  const response = {statusCode: 200};
  if (event.slack.type === "url_verification"){
    response.body = event.slack.challenge;
  }
 callback(null, response);
 return event;
}

const verifyToken = (event) => {
  if (event.slack.token !== process.env.VERIFICATION_TOKEN) {
    throw new Error("InvalidToken");
  }
  return event;
}
const checkForMention = (event) => {
  const message = event.slack.event.text;
  const botUserId = event.team.bot.bot_user_id;
  const botUserIsMentioned = new RegExp(`^<@${botUserId}>.*$`)
  if (botUserIsMentioned.test(message)) {
    console.log(`Bot ${botUserId} is mentioned in "${message}"`);
    return event;
  }
}
const actionFunctionName = `${process.env.NAMESPACE}-actions`;

const invokeAction = (event) => {
  if (!event) return null;
  console.log(`Invoking ${actionFunctionName} with event`, event)
  return lambda.invoke({
    FunctionName: actionFunctionName,
    InvocationType: "Event",
    LogType: "None",
    Payload: JSON.stringify(event)}).promise();
}

module.exports.handler = (event, context, callback) =>
  Promise.resolve(event)
    .then(getSlackEvent)
    .then(respond(callback))
    .then(verifyToken)
    .then(getTeam)
    .then(checkForMention)
    .then(invokeAction)
    .catch(callback);
