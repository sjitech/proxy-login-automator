var cfg = process.argv.slice(2/*skip ["node", "xxx.js"]*/).reduce(function(cfg, arg, i, argv) {
    i%2===0 && arg.slice(0,2)==='--' && (cfg[arg.slice(2)] = argv[i+1]);
    return cfg;
}, /*init cfg:*/ {host: 'localhost', port: 8080, remote_host:8080});

if (!cfg.remote_host)
    return console.error('Usage of parameters:\n'+
    '\t[--host host]\t\t'+'listening address. Default: localhost. (* means all interfaces)\n'+
    '\t[--port port]\t\t'+'listening port. Default: 8080\n'+
    '\t<--remote_host host>\t\t'+'real proxy server address\n'+
    '\t[--remote_port port]\t\t'+'real proxy server port. Default: 8080\n'+
    '\t[--pac urlPath]\t\t'+'proxy_auto_config_file_url_path');
console.error('Using parameters:\n' + JSON.stringify(cfg, null, '  '));
    
    
var net = require('net'), t;
var HTTPParser = process.binding('http_parser').HTTPParser;

net.createServer({allowHalfOpen:true}, function(socket){
    var realCon = net.connect({port:cfg.remote_port, host:cfg.remote_host, allowHalfOpen:true});
    realCon.on('data', function(buf) {
        //console.log('<<<<' + (t=new Date()) + '.' + t.getMilliseconds() + '\n' + buf.toString('ascii'));
        socket.write(buf);
    }).on('end', function() {
        socket.end();
    }).on('close', function() {
        socket.end();
    }).on('error', dummy);

    var parser = new HTTPParser(HTTPParser.REQUEST);
    parser[HTTPParser.kOnHeadersComplete] = function() {
        console.log('---- kOnHeadersComplete----');
        console.log(arguments);
    };
    parser[HTTPParser.kOnMessageComplete] = function() {
        console.log('---- kOnMessageComplete----');
        console.log(arguments);
    };

    socket.on('data', function(buf){
        //console.log('>>>>' + (t=new Date()) + '.' + t.getMilliseconds() + '\n' + buf.toString('ascii'));
        var ret = parser.execute(buf);
        console.log('\n\n----parser result: ' + ret + ' buf len:'+buf.length);
        realCon.write(buf);
    }).on('end', function() {
        if (parser) {
            parser.close();
            parser = null;
        }
        realCon.end();
    }).on('close', function() {
        realCon.end();
        if (parser) {
            parser.close();
            parser = null;
        }
    }).on('error', dummy);
}).listen(cfg.port, cfg.host==='*'?undefined:cfg.host);

function dummy() {}
