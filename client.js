let grpc = require("grpc");
var protoLoader = require("@grpc/proto-loader");
var readline = require("readline");
 
//Reading the terminal Lines
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
 
//protobuf
var proto = grpc.loadPackageDefinition(
  protoLoader.loadSync("./chat.proto", {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
);
 
const REMOTE_SERVER = "0.0.0.0:5001";
 
//gRPC client
let client = new proto.MessageSender.Chat(
  REMOTE_SERVER,
  grpc.credentials.createInsecure()
);
 
//Starting the stream between server and client
function startChat() {
  let channel = client.join();
 
  channel.on("data", onData);
 
  
  rl.on("line", function(message) {
    client.send({message: message }, res => {});
});
}

//When server send a message
function onData(message) {

  console.log(`${message.text}`);
}
 
startChat();
 