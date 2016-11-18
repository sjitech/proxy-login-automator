'use strict';
var net = require('net');
var HTTPParser = process.binding('http_parser').HTTPParser;
var http = require('http');
var url = require('url');

function main() {
    //convert `--key value` to cfg[key]=value
    var cfg = process.argv.slice(2/*skip ["node", "xxx.js"]*/).reduce(function (cfg, arg, i, argv) {
        i % 2 === 0 && (arg.slice(0, 2) === '--' && (cfg[arg.slice(2)] = argv[i + 1]) || arg.slice(0, 1) === '-' && (cfg[arg.slice(1)] = argv[i + 1]));
        return cfg;
    }, /*init cfg:*/ {local_host: 'localhost', local_port: 8080, remote_host: 8080});
    cfg.local_host = cfg.local_host || cfg.host;
    cfg.local_port = Number(cfg.local_port || cfg.port);
    cfg.remote_port = Number(cfg.remote_port);
    cfg.as_pac_server = cfg.as_pac_server === 'true';

    if (!cfg.local_host || !cfg.local_port || !cfg.remote_host || !cfg.usr || !cfg.pwd)
        return console.error('Usage of parameters:\n'
            + '\t-local_host host\t\t' + 'listening address. Default: localhost. (* means all interfaces)\n'
            + '\t-local_port port\t\t' + 'listening port. Default: 8080\n'
            + '\t-remote_host host\t\t' + 'real proxy server address\n'
            + '\t-remote_port port\t\t' + 'real proxy server port. Default: 8080\n'
            + '\t-usr user\t\t' + 'proxy user id\n'
            + '\t-pwd password\t\t' + 'proxy user password\n'
            + '\t-as_pac_server true or false \t\t' + 'used as pac(proxy auto configuration) server. Default: no\n'
        );
    console.error('Using parameters:\n' + JSON.stringify(cfg, null, '  '));
    cfg.buf_proxy_basic_auth = new Buffer('Proxy-Authorization: Basic ' + new Buffer(cfg.usr + ':' + cfg.pwd).toString('base64'));

    if (cfg.as_pac_server) {
        createPacServer(cfg.local_host, cfg.local_port, cfg.remote_host, cfg.remote_port, cfg.buf_proxy_basic_auth);
    } else {
        createPortForwarder(cfg.local_host, cfg.local_port, cfg.remote_host, cfg.remote_port, cfg.buf_proxy_basic_auth);
    }
}

var CR = 0xd, LF = 0xa, BUF_CR = new Buffer([0xd]), BUF_CR_LF_CR_LF = new Buffer([0xd, 0xa, 0xd, 0xa]), BUF_LF_LF = new Buffer([0xa, 0xa]);
var STATE_NONE = 0, STATE_FOUND_LF = 1, STATE_FOUND_LF_CR = 2;

function createPortForwarder(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth) {
    net.createServer({allowHalfOpen: true}, function (socket) {
        var realCon = net.connect({port: remote_port, host: remote_host, allowHalfOpen: true});
        realCon.on('data', function (buf) {
            //console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
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
            //console.log('[' + remote_host + ':' + remote_port + ']>>>>' + (Date.t = new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
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
                        buf_ary.push(buf.slice(unsavedStart, buf[i - 1] === CR ? i - 1 : i));
                        //console.log('insert auth header');
                        buf_ary.push(buf_proxy_basic_auth);
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
    }).on('error', function (err) {
        console.log('Failed to listen at ' + local_host + ':' + local_port + '\n' + err);
        process.exit(1);
    }).listen(local_port, local_host === '*' ? undefined : local_host, function () {
        console.log('OK: forward ' + local_host + ':' + local_port + ' to ' + remote_host + ':' + remote_port);
    });
}

var proxyAddrMap = {};

function createPacServer(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth) {
    http.createServer(function (req, res) {

        var internal_req = url.parse(req.url);

        internal_req.host = remote_host;
        internal_req.port = remote_port;
        internal_req.headers = req.headers;
        internal_req.keepAlive = req.headers['connection'] === 'keep-alive';

        http.get(internal_req, function (internal_res) {

            delete internal_res.headers['content-length'];
            delete internal_res.headers['transfer-encoding'];

            res.writeHead(internal_res.statusCode, internal_res.headers);

            var buf_ary = [];
            internal_res.on('data', function (buf) {
                // console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
                buf_ary.push(buf);
            }).on('end', function () {
                var s = Buffer.concat(buf_ary).toString();
                buf_ary = [];
                s = s.replace(/PROXY\s+([^'":\s]+)(:\d+)?/g, function (matched_all, matched_remote_host, matched_comma_remote_port) {
                    var _remote_port = matched_comma_remote_port && Number(matched_comma_remote_port.slice(1)) || 80;
                    var remoteAddr = matched_remote_host + ':' + _remote_port;
                    var _local_port = proxyAddrMap[remoteAddr];
                    if (!_local_port) {
                        _local_port = local_port + Object.keys(proxyAddrMap).length + 1;
                        proxyAddrMap[remoteAddr] = _local_port;
                        createPortForwarder(local_host, _local_port, matched_remote_host, _remote_port, buf_proxy_basic_auth);
                    }
                    return 'PROXY localhost:' + _local_port;
                });
                //console.log('return patched pac');
                res.end(s);
            }).on('error', dummy);
        });
        res.on('error', dummy);
    }).on('error', function (err) {
        console.log('Failed to listen at ' + local_host + ':' + local_port + '\n' + err);
        process.exit(1);
    }).listen(local_port, local_host === '*' ? undefined : local_host, function () {
        console.log('OK: listen at ' + local_host + ':' + local_port);
    });
}

function dummy() {
}

main();
