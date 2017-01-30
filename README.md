# proxy-login-automator
Automatically send user/password to http proxy server via a local forwarder. PAC is also supported.

- This is done by creating a local proxy server which forward requests to real proxy server with password injected.
You change your browser's proxy config to use the local proxy server so that you can browse internet 
without being asked for user/password.

- Can act as a [PAC(proxy auto configuration)](https://en.wikipedia.org/wiki/Proxy_auto-config) server if real proxy provides PAC. 
In this case, each real proxy server defined in PAC will be dynamically replaced with a local proxy server
which forward requests to real proxy with password injected.

## Usage

- Please install node.js first.
 
- Download & cd this project dir, run `node proxy-login-automator.js ...`. 

  For Linux/Mac users, you can install it by `npm install -g proxy-login-automator` 
  then run `proxy-login-automator.js` directly. 

- Parameters of `proxy-login-automator.js`:

    ```
    -local_host host        listening address. Default: localhost. (* means all interfaces)
    -local_port port        listening port. Default: 8080
    -remote_host host       real proxy server address
    -remote_port port       real proxy server port. Default: 8080
    -usr user       proxy user id
    -pwd password   proxy user password
    -as_pac_server true/false       used as pac(proxy auto configuration) server. Default: false
    -is_remote_https true/false     talk to real proxy server with HTTPS. Default: false
    -chk_remote_cert true/false     check real proxy server SSL certificate. Default: true
    ```

##Example1: normal Proxy Server

- You have a proxy server `http://REAL_PROXY_IP:8080`

    This server requires a user/password.

- You run following command to create a local trampoline at `localhost:8081`

    ```
    node proxy-login-automator.js -local_port 8081 -remote_host REAL_PROXY_IP -remote_port 8080 -usr USER -pwd PASSWORD
    ```

- Then you can set your browser's proxy ip:port = `localhost:8081` manually or close Chrome then run following command

    ```
    path_of_Chrome --proxy-server=http://localhost:8081
    ```

##Example2: [PAC(proxy auto configuration)](https://en.wikipedia.org/wiki/Proxy_auto-config) Server

- You have a pac server serving at `http://REAL_PROXY_IP:8080/REAL_PAC_PATH`

    This server may require a user/password or not, it does not matter.

    The REAL_PAC_PATH points to a [PAC file](https://en.wikipedia.org/wiki/Proxy_auto-config)
    which contains instructions says
    ```
    /*on some condition ...*/ return "PROXY proxy1:port1"
    /*on another condition...*/ return "PROXY proxy2:port2" 
    /*on other condition...*/ return "DIRECT" 
    ```
    means use child proxy servers proxy1:port1 and proxy2:port2.
     
    **Assume all user/password are same**.
  
- You run following command to create a trampoline at `http://localhost:65000//REAL_PAC_PATH`

    ```
	node proxy-login-automator.js -local_port 65000 -remote_host REAL_PROXY_IP -remote_port 8080 -usr USER -pwd PASSWORD -as_pac_server true
	```

    - This tool dynamically creates multiple child proxy servers which auto inject user/password when talking to real proxy servers.
    
    - The child proxy servers will listen at `localhost:65001`, `localhost:65002` for proxy1:port1, proxy2:port2 ... respectively.
  
    **Please specify large local port number because i use multiple local port incrementally like 65001, 65002, ....**

- Then you can set your browser's PAC url = `http://localhost:65000/REAL_PAC_PATH` manually or close Chrome then run following command

    ```
	path_of_Chrome --proxy-pac-url=http://localhost:65000/REAL_PAC_PATH
	```

##Note for "Windows Store Apps"

The Windows Store Apps (such as pre-installed Weather, Calender) maybe use "Isolated Network" settings which does not respect Internet Option of IE or control panel.

Windows Store Apps may have its own network policy such as how to connect to internet.
There are group policy Computer Configuration\Policies\Administrative Templates\Network\Network Isolation\Internet proxy servers for apps to serve these apps.

To change proxy of "Windows Store Apps"
See http://www.thewindowsclub.com/setup-proxy-metro-application-windows-8

##Note for other authentication(such as NTLM)

This tool currently only support HTTP basic authentication to real proxy server. 

If you want to use other authentication such as NTLM,
you can use other tool such as [NGINX reverse proxy to NTLM authenticated http server](http://nginx.org/en/docs/http/ngx_http_upstream_module.html#ntlm).

##Note for HTTPS 

Proxy Server normally supports HTTPS browsing by [handling HTTP tunnel request](https://en.wikipedia.org/wiki/HTTP_tunnel),
so this tool also support HTTPS browsing of course if the real proxy server does.

However, due to historical reason, **most browsers always use HTTP to talk to proxy server
even when browsing HTTPS sites**(done by HTTP tunnel described in above link). 

Currently only Chrome support HTTPS talking. 

So this tool only use HTTP to talk to real proxy server. **You can use NGINX to redirect HTTP to other HTTPS server**.

###2017/01/30: now support talk to real proxy server with HTTPS by specify `-is_remote_https true`. in this case, to avoid SSL certificate verification error, you can specify `-chk_remote_cert false` 

Note: anyway, the local proxy server is always served as a HTTP server. 

Good luck
