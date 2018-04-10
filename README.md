# proxy-login-automator
A single node.js script to automatically inject user/password to http proxy server via a local forwarder

- This is done by creating a local proxy server which forward requests to real proxy server with password injected.
You change your browser's proxy config to use the local proxy server so that you can browse internet 
without being asked for user/password.

- Can act as a [PAC(proxy auto configuration)](https://en.wikipedia.org/wiki/Proxy_auto-config) server if real proxy provides PAC. 
In this case, each real proxy server defined in PAC will be dynamically replaced with a local proxy server
which forward requests to real proxy with password injected.

## Usage

- Please install node.js first.
 
- Install & Run

  - Normal way: Download & cd this project dir then run the js from node.
  ```
  git clone https://github.com/sjitech/proxy-login-automator
  node proxy-login-automator/proxy-login-automator.js
  ```

  - NPM way: You can also install it by npm then run it directly
  ```
  npm install -g proxy-login-automator
  proxy-login-automator
  ```

  - Geek way: If you do not want to save anything to your disk then you can run this command in `bash`
  ```
  node <(curl -sSL https://raw.githubusercontent.com/sjitech/proxy-login-automator/master/proxy-login-automator.js)
  ```

- Parameters of `proxy-login-automator.js`:

    ```
    -local_host host        Listening address. Default: localhost. (* means all interfaces)
    -local_port port        Listening port. Default: 8080
    -remote_host host       Real proxy/PAC server address
    -remote_port port       Real proxy/PAC server port. Default: 8080
    -usr user               Real proxy/PAC server user id
    -pwd password           Real proxy/PAC user password
    -as_pac_server true/false       Treat real proxy/PAC server as a PAC server. Default: false
    
    -is_remote_https true/false     Talk to real proxy/PAC server with HTTPS. Default: false
    -ignore_https_cert true/false   ignore error when verify certificate of real proxy/PAC server. Default: false
    -are_remotes_in_pac_https true/false    Talk to proxy servers defined in PAC with HTTPS. Default: false
    ```

### Normal Proxy Server

- You have a proxy server `http://REAL_PROXY_IP:8080`

    This server requires a user/password.

- You run following command to create a local trampoline at `localhost:8081`

    Mac/Linux:
    ```
    node proxy-login-automator.js \
        -local_port 8081 \
        -remote_host REAL_PROXY_IP \
        -remote_port 8080 \
        -usr USER -pwd PASSWORD
    ```
    Windows:
    ```
    node proxy-login-automator.js ^
        -local_port 8081 ^
        -remote_host REAL_PROXY_IP ^
        -remote_port 8080 ^
        -usr USER -pwd PASSWORD
    ```

- Then you can set your browser's proxy = `localhost:8081`

    As a quick test, you can start a new process of chrome with the local proxy:

    MacOS/Linux: (for Linux, just change the path of Chrome please):
    ```
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
        --user-data-dir=$HOME/chrome_data/ \
        --proxy-server=http://localhost:8081 \
        >/dev/null 2>&1 &
    ```
    Windows:
    ```
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" ^
        --user-data-dir=%APPDATA%\chrome_data ^
        --proxy-server=http://localhost:8081
    ```

### [PAC(proxy auto configuration)](https://en.wikipedia.org/wiki/Proxy_auto-config) Server

- You have a pac server serving at `http://REAL_PAC_SERVER_IP:8080/PAC_PATH/PAC_NAME`

    This server may require a user/password or not, it does not matter.

    The PAC_PATH/PAC_NAME points to a [PAC file](https://en.wikipedia.org/wiki/Proxy_auto-config)
    which contains instructions says
    ```
    function FindProxyForURL(url, host) {
        if (shExpMatch(url,"*.google.com*")) return "PROXY proxy1:port1"
        if (shExpMatch(url,"*.microsoft.com*")) return "PROXY proxy2:port2"
        ...
        return "DIRECT"
    }
    ```
    means use child proxy servers
    ```
    proxy1:port1
    proxy2:port2
    ...
    ```

    **Assume all user/password are same**.

    If you want use your own local PAC file, you need set up a local http server to serve the PAC file.
    See [use a local pac](https://github.com/sjitech/proxy-login-automator/issues/14#issuecomment-379951268).

- You run following command to create a trampoline at `http://localhost:65000/PAC_PATH/PAC_NAME`

    Mac/Linux:
    ```
	node proxy-login-automator.js \
	    -local_port 65000 \
	    -remote_host REAL_PAC_SERVER_IP \
	    -remote_port 8080 \
	    -usr USER -pwd PASSWORD \
	    -as_pac_server true
	```
    Windows:
    ```
	node proxy-login-automator.js ^
	    -local_port 65000 ^
	    -remote_host REAL_PAC_SERVER_IP ^
	    -remote_port 8080 ^
	    -usr USER -pwd PASSWORD ^
	    -as_pac_server true
	```

    - This tool dynamically creates multiple child proxy servers which auto inject user/password when talking to real proxy servers.

    - The child proxy servers will listen at
    ```
    localhost:65001 for proxy1:port1
    localhost:65002 for proxy2:port2
    ...
    ```

    **Please specify a big port number as PAC server port because this tool allocate ports INCREMENTALLY like**
    ```
    65000 + 1 for first detected proxy server from PAC
    65000 + 2 for second detected proxy server from PAC
    ....
    65000 + Count Of Real Proxy Servers
    ```

    If you specify a small port number as PAC server port, then the port allocation may fail due to other process may have been using that port.

- Then you can set your browser's PAC url = `http://localhost:65000/PAC_PATH/PAC_NAME`

    As a quick test, you can start a new process of chrome with the local PAC server:

    MacOS/Linux: (for Linux, just change the path of Chrome please):
    ```
    “/Applications/Google Chrome.app/Contents/MacOS/Google Chrome” \
       --user-data-dir=$HOME/chrome_data/ \
       --proxy-pac-url=http://localhost:65000/PAC_PATH/PAC_NAME \
       >/dev/null 2>&1 &
    ```
    Windows:
    ```
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" \
      --user-data-dir=%APPDATA%\chrome_data \
      --proxy-pac-url=http://localhost:65000/PAC_PATH/PAC_NAME
    ```

----

## Note for "Windows Store Apps"

The Windows Store Apps (such as pre-installed Weather, Calender) maybe use "Isolated Network" settings which does not respect Internet Option of IE or control panel.

Windows Store Apps may have its own network policy such as how to connect to internet.
There are group policy Computer Configuration\Policies\Administrative Templates\Network\Network Isolation\Internet proxy servers for apps to serve these apps.

To change proxy of "Windows Store Apps"
See [setup-proxy-metro-application-windows-8](http://www.thewindowsclub.com/setup-proxy-metro-application-windows-8)

## Note for other authentication(such as NTLM)

This tool currently only support HTTP basic authentication to real proxy/PAC server.

If you want to use other authentication such as NTLM,
you can use other tool such as [NGINX reverse proxy to NTLM authenticated http server](http://nginx.org/en/docs/http/ngx_http_upstream_module.html#ntlm).

2018/04/10: plan to support NTLM and other normal authentication.

## Note for HTTPS

Proxy Server normally supports HTTPS browsing by [handling HTTP tunnel request](https://en.wikipedia.org/wiki/HTTP_tunnel),
so this tool also support HTTPS browsing of course if the real proxy server does.

However, due to historical reason, **most browsers always use HTTP to talk to proxy server
even when browsing HTTPS sites**(done by HTTP tunnel described in above link).

Currently only Chrome support HTTPS talking.

So this tool only use HTTP to talk to real proxy server. **You can use NGINX to redirect HTTP to other HTTPS server**.

### 2017/01/30: now support talk to real proxy/PAC server with HTTPS by specify following parameters:

```
-is_remote_https true
```
in addition, to ignore error when verify HTTPS server certificate, you can specify
```
-ignore_https_cert true
```
For proxy servers defined in PAC, if they also need be talked with HTTPS, then specify
```
-are_remotes_in_pac_https true
```

Note: anyway, the local proxy/PAC server is always served as a HTTP server.

## Note for WebSocket

This tool support WebSocket if the real proxy server supports.

Good luck
