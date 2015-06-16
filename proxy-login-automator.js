'use strict';

//convert `--key value` to cfg[key]=value
var cfg = process.argv.slice(2/*skip ["node", "xxx.js"]*/).reduce(function (cfg, arg, i, argv) {
    i % 2 === 0 && arg.slice(0, 2) === '--' && (cfg[arg.slice(2)] = argv[i + 1]);
    return cfg;
}, /*init cfg:*/ {host: 'localhost', port: 8080, remote_host: 8080});

if (!cfg.remote_host || !cfg.usr || !cfg.pwd)
    return console.error('Usage of parameters:\n'
        + '\t[--host host]\t\t' + 'listening address. Default: localhost. (* means all interfaces)\n'
        + '\t[--port port]\t\t' + 'listening port. Default: 8080\n'
        + '\t<--remote_host host>\t\t' + 'real proxy server address\n'
        + '\t[--remote_port port]\t\t' + 'real proxy server port. Default: 8080\n'
        + '\t[--pac urlPath]\t\t' + 'proxy_auto_config_file_url_path\n'
        + '\t[--usr user]\t\t' + 'proxy user id\n'
        + '\t[--pwd password]\t\t' + 'proxy user password\n'
    );
console.error('Using parameters:\n' + JSON.stringify(cfg, null, '  '));
cfg.buf_proxy_basic_auth = new Buffer('Proxy-Authorization: Basic ' + new Buffer(cfg.usr + ':' + cfg.pwd).toString('base64'));

var CR = 0xd, LF = 0xa, BUF_CR_LF = new Buffer([0xd, 0xa]), BUF_LF = new Buffer([0xa]), BUF_CR = new Buffer([0xd]), BUF_CR_LF_CR_LF = new Buffer([0xd, 0xa, 0xd, 0xa]), BUF_LF_LF = new Buffer([0xa, 0xa]);
var STATE_NONE = 0, STATE_FOUND_LF = 1, STATE_FOUND_LF_CR = 2;

var net = require('net'), t;
var HTTPParser = process.binding('http_parser').HTTPParser;

net.createServer({allowHalfOpen: true}, function (socket) {
    var realCon = net.connect({port: cfg.remote_port, host: cfg.remote_host, allowHalfOpen: true});
    realCon.on('data', function (buf) {
        //console.log('<<<<' + (t=new Date()) + '.' + t.getMilliseconds() + '\n' + buf.toString('ascii'));
        socket.write(buf);
    }).on('end', function () {
        socket.end();
    }).on('close', function () {
        socket.end();
    }).on('error', dummy);

    var parser = new HTTPParser(HTTPParser.REQUEST);
    parser[HTTPParser.kOnHeadersComplete] = function () {
        //console.log('---- kOnHeadersComplete----');
        //console.log(arguments);
        parser.__is_headers_complete = true;
    };
    //parser[HTTPParser.kOnMessageComplete] = function () {
    //    console.log('---- kOnMessageComplete----');
    //    console.log(arguments);
    //};

    var state = STATE_NONE;

    socket.on('data', function (buf) {
        //console.log('>>>>' + (t = new Date()) + '.' + t.getMilliseconds() + '\n' + buf.toString('ascii'));
        //var ret = parser.execute(buf);
        //console.log('\n\n----parser result: ' + ret + ' buf len:' + buf.length);
        //realCon.write(buf);
        //return;

        var buf_ary = [], unsavedStart = 0, buf_len = buf.length;

        //process orphan CR
        if (state === STATE_FOUND_LF_CR && buf[0] !== LF) {
            parser.execute(BUF_CR);
            buf_ary.push(BUF_CR);
        }

        for (var i = 0; i < buf_len; i++) {
            //find first LF
            if (state === STATE_NONE) {
                if (buf[i] === LF) {
                    state = STATE_FOUND_LF;
                }
                continue;
            }

            //find second CR LF or LF
            if (buf[i] === LF) {
                parser.__is_headers_complete = false;
                parser.execute(buf.slice(unsavedStart, i + 1));

                if (parser.__is_headers_complete) {
                    //console.log('insert auth header');
                    buf_ary.push(buf.slice(unsavedStart, buf[i - 1] === CR ? i - 1 : i));
                    buf_ary.push(cfg.buf_proxy_basic_auth);
                    buf_ary.push(state === STATE_FOUND_LF_CR ? BUF_CR_LF_CR_LF : BUF_LF_LF);

                    unsavedStart = i + 1;
                    state = STATE_NONE;
                }
                else {
                    state = STATE_FOUND_LF;
                }
            }
            else if (buf[i] === CR && state === STATE_FOUND_LF) {
                state = STATE_FOUND_LF_CR;
            } else {
                state = STATE_NONE;
            }
        }

        if (unsavedStart < buf_len) {
            //strip last CR if found LF_CR
            buf = buf.slice(unsavedStart, state === STATE_FOUND_LF_CR ? buf_len - 1 : buf_len);
            if (buf.length) {
                parser.execute(buf);
                buf_ary.push(buf);
            }
        }

        buf = Buffer.concat(buf_ary);
        realCon.write(buf);

    }).on('end', cleanup).on('close', cleanup).on('error', dummy);

    function cleanup() {
        if (parser) {
            parser.close();
            parser = null;
        }
        realCon.end();
    }
}).listen(cfg.port, cfg.host === '*' ? undefined : cfg.host);

function dummy() {
}