# proxy-password-automator
automatically send user/password to http proxy server so you do not need to input it manually<br><br>

Example:<br>
Run:  (please install node.js first)<br>
        node proxy-login-automator.js  --port 8600 --remote_host real_proxy_ip --remote_port 8080 --usr usr1 --pwd password1<br>

then Run:<br>
<br>
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --proxy-server=http://localhost:8600<br>


<br>
<br>
Usage of parameters: <br>
        [--host host]           listening address. Default: localhost. (* means all interfaces) <br>
        [--port port]           listening port. Default: 8080 <br>
        <--remote_host host>            real proxy server address <br>
        [--remote_port port]            real proxy server port. Default: 8080 <br>
        [--pac urlPath]         proxy_auto_config_file_url_path <br>
        [--usr user]            proxy user id <br>
        [--pwd password]                proxy user password <br>


