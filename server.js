const env = require('dotenv').config()
const request = require('request');
const {createMessageAdapter} = require('@slack/interactive-messages');
const { WebClient } = require('@slack/client');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const smb = require('slack-message-builder')

//If the environment variables don't get loaded
if(env.error){
    throw env.error
}

const slackVerificationToken = process.env.SLACK_VERIFICATION_TOKEN;
const slackAccessToken = process.env.SLACK_ACCESS_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

const slackInteractions = createMessageAdapter(slackVerificationToken);
const web = new WebClient(slackAccessToken);
const app = express();
app.use(bodyParser.urlencoded({extended: false}));

app.use('/slack/actions', slackInteractions.expressMiddleware());
app.post('/slack/commands',slackSlashCommands);

slackInteractions.action({callbackId: 'answer', type: 'button'}, (payload,respond) =>{

    // We have to avoid the Slack Message Builder package when working with pre-existing messages because it's just wrong...
    var clickedButton = payload.original_message.attachments[0].actions[(payload.actions[0].value.split(',')[0] - 1)];

    // This ensures that the user has only voted on one of the options.
    if(!payload.original_message.text.includes("(Multiple Answers Allowed)")){
        for(let i = 0; i < payload.original_message.attachments[0].actions.length; i++){
            let currentAction = payload.original_message.attachments[0].actions[i];
            let currentValue = new Set(currentAction.value.split(','));
            if(currentValue.has(payload.user.id)){
                currentValue.delete(payload.user.id);
                currentAction.value = Array.from(currentValue).join(',');
            }
        }
    }

    var newButtonValue = clickedButton.value + ',' + payload.user.id;
    // We don't want multiple of the same people to have voted
    newButtonValue = new Set(newButtonValue.split(','));
    clickedButton.value = Array.from(newButtonValue).join(',');

    var resultString = generateResultString(payload);

    var currentMessage = smb(payload.original_message);
    // If the person is the first voter
    if (payload.original_message.attachments.length == 2){
        currentMessage.attachment().text(resultString).color('#32CD32').end();
    }else{
        currentMessage.attachments.get(-1).text(resultString).color('#32CD32').end();
    }
    return currentMessage.json();
});

slackInteractions.action({callbackId: 'options', type: 'button'}, (payload,respond) =>{
    console.log(payload);
    if (payload.actions[0].name == 'deletepoll')
    {
        if (payload.user.id == payload.actions[0].value){
            return "This poll has been deleted.";
        }else{
            web.chat.postEphemeral({channel: payload.channel.id, text: "Only the poll author may delete the poll.", user:payload.user.id});
        }
    }else if (payload.actions[0].name == 'resetvote'){
        
        for(let i = 0; i < payload.original_message.attachments[0].actions.length; i++){
            let currentAction = payload.original_message.attachments[0].actions[i];
            let currentValue = new Set(currentAction.value.split(','));
            if(currentValue.has(payload.user.id)){
                currentValue.delete(payload.user.id);
                currentAction.value = Array.from(currentValue).join(',');
            }
        }

        var resultString = generateResultString(payload);
    
        var currentMessage = smb(payload.original_message);
        // If the person is the first voter
        if (payload.original_message.attachments.length == 2){
            currentMessage.attachment().text(resultString).color('#32CD32').end();
        }else{
            currentMessage.attachments.get(-1).text(resultString).color('#32CD32').end();
        }
        return currentMessage.json();
    }else if (payload.actions[0].name == 'movepoll'){
        var currentMessage = smb(payload.original_message);
        web.chat.delete({channel: payload.channel.id, ts: payload.message_ts});
        web.chat.postMessage({channel:payload.channel.id, text: payload.original_message.text, attachments: payload.original_message.attachments});
    }
});

function generateResultString(payload){

    var resultString = "";
    for(let i = 0; i < payload.original_message.attachments[0].actions.length; i++){
        let currentAction = payload.original_message.attachments[0].actions[i];
        // Don't need a set here because we already removed the repeats.
        let currentValue = currentAction.value.split(',');
        let numberOfVotes = currentValue.length - 1;
        if(numberOfVotes == 0){
            continue;
        }
        resultString += currentAction.text + " (" + numberOfVotes + ")" + " =>";
        for (let x = 1; x < currentValue.length; x++){
            resultString += " " + "<@" + currentValue[x] + ">,";
        }
        
        if(resultString.slice(-1) == ','){
            resultString = resultString.slice(0,-1);
        }
    
        resultString += "\n";
    }
    resultString = strip(resultString);
    return resultString;
}

const port = process.env.PORT || 3000;

http.createServer(app).listen(port,() =>{
    console.log(`Server listening on port ${port}`);
});

function slackSlashCommands(req,res,next){
    /* This is all to verify that the command is coming from slack
    var timeStamp  = req.header('X-Slack-Request-Timestamp');
    var sigBaseString = 'v0:' + timeStamp + ':' + JSON.stringify(req.body);
    var hmachHash = crypto.createHmac('sha256', slackSigningSecret).update('v0=' + sigBaseString).digest('hex');
    var slackSignature = req.header('X-Slack-Signature');*/
    // If the command came from slack (this is susceptible to a timing attack, but it's just a slack polling extension...)
    if(req.body.token == slackVerificationToken){

        if(req.body.command === '/inorout'){
            var pollParameters = req.body.text.split('\n');
            var slackMessage = smb().responseType('in_channel');
            if (isMultipleFirstWord(pollParameters[0])){
                let titleArray = pollParameters[0].split(" ");
                titleArray.splice(0, 1);
                pollParameters[0] = titleArray.join(" ");
                // I'm unsure if I like the newline or not
                pollParameters[0] = pollParameters[0] + "(Multiple Answers Allowed)";
            }
            var attachmentArray = slackMessage.text(pollParameters[0]).attachment().callbackId('answer')
            for(var i = 1; i < pollParameters.length; i++){
                attachmentArray.button().name('answer').text(pollParameters[i]).type('button').value(i).end()
            }
            var optionsButtons = slackMessage.attachment().callbackId('options').color('#0000FF');
            optionsButtons.button().text("Reset vote").name('resetvote').type('button').end();
            optionsButtons.button().text("Move to Bottom").name('movepoll').type('button').end();
            optionsButtons.button().text("Delete Poll").name('deletepoll').type('button').style('danger').value(req.body.user_id).end();
            slackMessage.json();
            request({
                url: req.body.response_url,
                method: "POST",
                json: true,
                body: slackMessage
            });
            res.send();
        }
    }else{
        console.log("Comparison failed.");
        next();
    }
}

// Removes the whitespace from the end of strings
function strip(str) {
    return str.replace(/^\s+|\s+$/g, '');
}

function isMultipleFirstWord(title){
    let titleWords = title.split(" ");
    if (titleWords[0].toUpperCase() === "MULTIPLE"){
        return true;
    }else{
        return false;
    }
}