#!/usr/bin/env node
'use strict';
var net = require('net'), tls = require('tls');
var HTTPParser = process.binding('http_parser').HTTPParser;
var http = require('http'), https = require('https');
var url = require('url');

function main() {
  //convert `-key value` to cfg[key]=value
  var cfg = process.argv.slice(2/*skip ["node", "xxx.js"]*/).reduce(function (cfg, arg, i, argv) {
    return (i % 2 === 0 && (arg.slice(0, 1) === '-' && (cfg[arg.slice(1)] = argv[i + 1])), cfg);
  }, {local_host: '', local_port: 0, remote_host: '', remote_port: 0, usr: '', pwd: '', as_pac_server: 0});
  cfg.local_host = cfg.local_host || 'localhost';
  cfg.local_port = (cfg.local_port & 0xffff) || 8080;
  cfg.remote_port = (cfg.remote_port & 0xffff) || 8080;
  cfg.as_pac_server = cfg.as_pac_server === 'true';
  cfg.is_remote_https = cfg.is_remote_https === 'true';
  cfg.ignore_https_cert = cfg.ignore_https_cert === 'true';
  cfg.are_remotes_in_pac_https = cfg.are_remotes_in_pac_https === 'true';

  if (!cfg.local_host || !cfg.local_port || !cfg.remote_host || !cfg.remote_port || !cfg.usr || !cfg.pwd)
    return console.error('Usage of parameters:\n'
      + '-local_host host\t' + 'Listening address. Default: localhost. (* means all interfaces)\n'
      + '-local_port port\t' + 'Listening port. Default: 8080\n'
      + '-remote_host host\t' + 'Real proxy/PAC server address\n'
      + '-remote_port port\t' + 'Real proxy/PAC server port. Default: 8080\n'
      + '-usr user\t\t' + 'Real proxy/PAC server user id\n'
      + '-pwd password\t\t' + 'Real proxy/PAC user password\n'
      + '-as_pac_server true/false\t' + 'Treat real proxy/PAC server as a PAC server. Default: false\n'
      + '\n'
      + '-is_remote_https true/false\t' + 'Talk to real proxy/PAC server with HTTPS. Default: false\n'
      + '-ignore_https_cert true/false\t' + 'ignore error when verify certificate of real proxy/PAC server. Default: false\n'
      + '-are_remotes_in_pac_https true/false\t' + 'Talk to proxy servers defined in PAC with HTTPS. Default: false\n'
    );
  if (cfg.as_pac_server && (cfg.local_host === '*' || cfg.local_host === '0.0.0.0' || cfg.local_host === '::')) {
    return console.error('when use as a PAC server, the local_host parameter must be a definite address');
  }
  console.log('Using parameters: ' + JSON.stringify(cfg, null, '  '));
  cfg.buf_proxy_basic_auth = new Buffer('Proxy-Authorization: Basic ' + new Buffer(cfg.usr + ':' + cfg.pwd).toString('base64'));

  if (cfg.as_pac_server) {
    createPacServer(cfg.local_host, cfg.local_port, cfg.remote_host, cfg.remote_port, cfg.buf_proxy_basic_auth, cfg.is_remote_https, cfg.ignore_https_cert, cfg.are_remotes_in_pac_https);
  } else {
    createPortForwarder(cfg.local_host, cfg.local_port, cfg.remote_host, cfg.remote_port, cfg.buf_proxy_basic_auth, cfg.is_remote_https, cfg.ignore_https_cert);
  }
}

var CR = 0xd, LF = 0xa, BUF_CR = new Buffer([0xd]), BUF_CR_LF_CR_LF = new Buffer([0xd, 0xa, 0xd, 0xa]),
  BUF_LF_LF = new Buffer([0xa, 0xa]), BUF_PROXY_CONNECTION_CLOSE = new Buffer('Proxy-Connection: close');
var STATE_NONE = 0, STATE_FOUND_LF = 1, STATE_FOUND_LF_CR = 2;

function createPortForwarder(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth, is_remote_https, ignore_https_cert) {
  net.createServer({allowHalfOpen: true}, function (socket) {
    var realCon = (is_remote_https ? tls : net).connect({
      port: remote_port, host: remote_host, allowHalfOpen: true,
      rejectUnauthorized: !ignore_https_cert /*not used when is_remote_https false*/
    });
    realCon.on('data', function (buf) {
      //console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
      socket.write(buf);
      realCon.__haveGotData = true;
    }).on('end', function () {
      socket.end();
      if (!realCon.__haveGotData && !realCon.__haveShownError) {
        console.error('[LocalProxy(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] Error: ended by remote peer');
        realCon.__haveShownError = true;
      }
    }).on('close', function () {
      socket.end();
      if (!realCon.__haveGotData && !realCon.__haveShownError) {
        console.error('[LocalProxy(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] Error: reset by remote peer');
        realCon.__haveShownError = true;
      }
    }).on('error', function (err) {
      console.error('[LocalProxy(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] ' + err);
      realCon.__haveShownError = true;
    });

    var parser = new HTTPParser(HTTPParser.REQUEST);
    parser[HTTPParser.kOnHeadersComplete] = function (versionMajor, versionMinor, headers, method,
                                                      url, statusCode, statusMessage, upgrade,
                                                      shouldKeepAlive) {
      //console.log('---- kOnHeadersComplete----');
      //console.log(arguments);
      parser.__is_headers_complete = true;
      parser.__upgrade = upgrade;
      parser.__method = method;
    };
    //parser[HTTPParser.kOnMessageComplete] = function () {
    //    console.log('---- kOnMessageComplete----');
    //    console.log(arguments);
    //};

    var state = STATE_NONE;

    socket.on('data', function (buf) {
      if (!parser) {
        realCon.write(buf);
        return
      }
      //console.log('[' + remote_host + ':' + remote_port + ']>>>>' + (Date.t = new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
      //var ret = parser.execute(buf);
      //console.log('\n\n----parser result: ' + ret + ' buf len:' + buf.length);
      //realCon.write(buf);
      //return;

      var buf_ary = [], unsavedStart = 0, buf_len = buf.length;

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

            // stop intercepting packets if encountered TLS and WebSocket handshake
            if (parser.__method === 5 /*CONNECT*/ || parser.__upgrade) {
              parser.close();
              parser = null;

              buf_ary.push(buf.slice(i + 1));
              realCon.write(Buffer.concat(buf_ary));

              state = STATE_NONE;
              return;
            }

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
        buf = buf.slice(unsavedStart, buf_len);
        parser.execute(buf);
        buf_ary.push(buf);
      }

      realCon.write(Buffer.concat(buf_ary));

    }).on('end', cleanup).on('close', cleanup).on('error', function (err) {
      if (!socket.__cleanup) {
        console.error('[LocalProxy(:' + local_port + ')][Incoming connection] ' + err);
      }
    });

    function cleanup() {
      socket.__cleanup = true;
      if (parser) {
        parser.close();
        parser = null;
      }
      realCon.end();
    }
  }).on('error', function (err) {
    console.error('[LocalProxy(:' + local_port + ')] ' + err);
    process.exit(1);
  }).listen(local_port, local_host === '*' ? undefined : local_host, function () {
    console.log('[LocalProxy(:' + local_port + ')] OK: forward http://' + local_host + ':' + local_port + ' to ' + ' to http' + (is_remote_https ? 's' : '') + '://' + remote_host + ':' + remote_port);
  });
}

var proxyAddrMap = {};

function createPacServer(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth, is_remote_https, ignore_https_cert, are_remotes_in_pac_https) {
  http.createServer(function (req, res) {

    var internal_req = url.parse(req.url);

    internal_req.host = remote_host;
    internal_req.port = remote_port;
    req.headers['host'] = remote_host + ':' + remote_port;
    if (!req.headers['authorization']) {
      req.headers['authorization'] = buf_proxy_basic_auth.slice('Proxy-Authorization: '.length).toString();
    }
    internal_req.headers = req.headers;
    internal_req.rejectUnauthorized = !ignore_https_cert; //only used for SSL

    (is_remote_https ? https : http).get(internal_req, function (internal_res) {

      delete internal_res.headers['content-length'];
      delete internal_res.headers['transfer-encoding'];

      res.writeHead(internal_res.statusCode, internal_res.headers);
      res.__haveWrittenData = true;

      var buf_ary = [];
      internal_res.on('data', function (buf) {
        // console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
        buf_ary.push(buf);
      }).on('end', function () {
        var s = Buffer.concat(buf_ary).toString();
        buf_ary = [];
        s = s.replace(/\bPROXY\s+([^'":;\s]+):(\d+)/g, function (_, host, port) {
          var remoteAddr = host + ':' + port;
          var _local_port = proxyAddrMap[remoteAddr];
          if (!_local_port) {
            _local_port = local_port + Object.keys(proxyAddrMap).length + 1;
            proxyAddrMap[remoteAddr] = _local_port;
            createPortForwarder(local_host, _local_port, host, Number(port), buf_proxy_basic_auth, are_remotes_in_pac_https, ignore_https_cert);
          }
          return 'PROXY ' + local_host + ':' + _local_port;
        });
        //console.log('return patched pac');
        res.end(s);
      }).on('error', function (err) {
        res.end();
        console.error('[LocalPAC][Reading response from ' + remote_host + ':' + remote_port + '] ' + err);
      });
    }).on('error', function (err) {
      if (!res.__haveWrittenData) {
        res.statusCode = 500;
        res.end();
      }
      console.error('[LocalPAC][Connection to ' + remote_host + ':' + remote_port + '] ' + err);
    });
    res.on('error', function (err) {
      console.error('[LocalPAC][Writing response] ' + err);
    });
  }).on('error', function (err) {
    console.error('[LocalPAC] ' + err);
    process.exit(1);
  }).listen(local_port, local_host === '*' ? undefined : local_host, function () {
    console.log('[LocalPAC] OK: forward http://' + local_host + ':' + local_port + ' to http' + (is_remote_https ? 's' : '') + '://' + remote_host + ':' + remote_port);
  });
}

main();
