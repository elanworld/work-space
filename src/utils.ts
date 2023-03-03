import os from 'os'
import childProcess from 'child_process'
import StreamZip from 'node-stream-zip'
import path from 'path'

const request = require('request')
const fs = require('fs')


function runSpawn(cmd: string, arg: readonly string[], options: childProcess.SpawnOptionsWithoutStdio) {
    let process = childProcess.spawn(cmd, arg, options)
    process.stdout && process.stdout.on('data', function (data) {
        console.log(data.toString())
    })
    process.stderr && process.stderr.on('data', function (data) {
        console.log(data.toString())
    })
    return process
}

function runCmdHold(cmd: string, options?: childProcess.SpawnOptionsWithoutStdio) {
    let strings = cmd.split(" ");
    let process = childProcess.spawn(strings[0], strings.slice(1, strings.length - 1), options)
    process.stdout && process.stdout.on('data', function (data) {
        console.log(data.toString())
    })
    process.stderr && process.stderr.on('data', function (data) {
        console.log(data.toString())
    })
    return process
}

function runExec(cmd: string) {
    let process = childProcess.exec(cmd);
    process.stdout && process.stdout.on('data', function (data) {
        console.log(data.toString())
    })
    process.stderr && process.stderr.on('data', function (data) {
        console.log(data.toString())
    })
    return process
}

function syncProcess(fun: (resolve: (value: unknown | PromiseLike<unknown>) => void) => void) {
    return new Promise((resolve) => {
        fun(resolve)
    })
}

function unzip(file: string, out: string, func: () => void) {
    let zip = new StreamZip({
        file: file,
        storeEntries: true
    })
    if (!fs.existsSync(out)) {
        fs.mkdirSync(out, {recursive: true}, () => {
        })
    }
    zip.on('ready', () => {
        zip.extract(null, out, (err, num) => {
            console.log(err ? err : `Extracted ${num} entries`)
            zip.close()
            func()
        })
    })
}


function downloadFile(uri: string, filename: string, callback: () => void) {
    let stream = fs.createWriteStream(filename)
    request(uri).pipe(stream).on('close', callback)

}

function writeFile(file: string, text: string) {
    fs.writeFileSync(file, text, {
        encoding: 'utf-8'
    })
}

function sleep(delay: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(''), delay)
    })
}

async function startNgrok(token: string, localPort: number) {
    let workDirectory = path.join(os.homedir(), 'cache-work')
    let fileUrl: string = '';
    if (os.platform() === 'linux') {
        fileUrl = 'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-386.zip'
    }
    if (os.platform() === 'win32') {
        fileUrl = 'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-windows-amd64.zip'
    }
    if (os.platform() === 'darwin') {
        fileUrl = 'https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-darwin-amd64.zip'
    }
    const dirName = 'ngrok-stable'
    const filename = dirName + '.zip'
    if (!fs.existsSync(workDirectory)) {
        fs.mkdirSync(workDirectory, {recursive: true}, () => {
        })
    }
    process.chdir(workDirectory)
    if (fs.existsSync(filename)) {
        console.log('file exists:' + filename)
    } else {
        await syncProcess(resolve => downloadFile(fileUrl, filename, () => resolve('')))
    }
    if (!fs.existsSync(dirName)) {
        await syncProcess(resolve => unzip(filename, dirName, () => resolve('')))
        process.chdir(dirName)
    } else {
        process.chdir(dirName)
    }
    let logFile = '.ngrok.log';
    if (fs.existsSync(logFile)) {
        fs.rmSync(logFile)
    }
    let frcExe = './ngrok';
    if (os.platform() === 'win32') {
        frcExe = 'ngrok.exe';
    } else {
        childProcess.execSync('chmod 777 ngrok')
    }
    childProcess.execSync(frcExe + ' authtoken ' + token);
    return runSpawn(frcExe, ['tcp', String(localPort), '--log', logFile], {})
}

function getUser(): string | undefined {
    let user = undefined
    if (os.platform() === 'linux') {
        user = process.env['USER']
    } else if (os.platform() === 'win32') {
        user = process.env.USERNAME
    } else {
        user = "virtual"
    }
    return user
}

function changePasswd(passwd: string) {
    let envUser = getUser();
    if (os.platform() === 'linux') {
        console.log(childProcess.execSync('sudo passwd -d ' + envUser).toString());
        let chpasswd = childProcess.spawn('passwd')
        chpasswd.stdin.write(passwd + '\n' + passwd + '\n')
        chpasswd.stdin.end()
        // add public key auth
        childProcess.execSync("sudo sed -i -e 's#\\#StrictModes yes#StrictModes no#' /etc/ssh/sshd_config")
        childProcess.execSync('sudo systemctl restart ssh')
    } else if (os.platform() === 'win32') {
        childProcess.execSync('net user ' + envUser + ' ' + passwd)
        childProcess.execSync("wmic /namespace:\\\\root\\cimv2\\terminalservices path win32_terminalservicesetting where (__CLASS != \"\") call setallowtsconnections 1")
        childProcess.execSync("wmic /namespace:\\\\root\\cimv2\\terminalservices path win32_tsgeneralsetting where (TerminalName ='RDP-Tcp') call setuserauthenticationrequired 0")
        childProcess.execSync("reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\" /v fSingleSessionPerUser /t REG_DWORD /d 0 /f")
    } else if (os.platform() === 'darwin') {
        let userAdd = path.resolve(__dirname, 'useradd.sh');
        childProcess.execSync('export USER=' + envUser)
        childProcess.execSync('chmod 777 ' + userAdd)
        childProcess.execSync('sudo ' + userAdd + ' virtual ' + passwd)
    } else {
        throw new Error("plat not support!")
    }
}

async function loopWaitAction(timeout: number, loopTime: number, fileSave: string, func: () => void) {
    writeFile(fileSave, timeout.toString())
    while (timeout > 0) {
        await sleep(loopTime * 1000)
        let line = fs.readFileSync(fileSave, 'utf-8')
        timeout = parseInt(line) - loopTime
        console.log('time limit:', timeout.toString())
        console.log('you can change it by run command: echo $second > ' + fileSave)
        console.log("user:", getUser())
        console.log('====================================')
        writeFile(fileSave, timeout.toString())
        func()
    }
}

async function startFrpc(server: string, remotePort: number) {
    let workDirectory = path.join(os.homedir(), "cache-work")
    const fileUrl = 'https://github.com/fatedier/frp/releases/download/v0.38.0/frp_0.38.0_linux_amd64.tar.gz'
    const dirName = 'frp_0.38.0_linux_amd64'
    const filename = dirName + '.tar.gz'
    if (!fs.existsSync(workDirectory)) {
        fs.mkdirSync(workDirectory, {recursive: true})
    }
    process.chdir(workDirectory)
    if (fs.existsSync(filename)) {
        console.log("file exists:" + filename)
    } else {
        await syncProcess(resolve => downloadFile(fileUrl, filename, () => resolve("")))
    }
    if (!fs.existsSync(dirName)) {
        let tar = runSpawn("tar", ["-xf", filename], {})
        await syncProcess(resolve => tar.on("exit", () => resolve('')))
        process.chdir(dirName)
        childProcess.execSync("sed -i -e 's#server_addr = 127.0.0.1#server_addr = "
            + server + "#' -e 's#remote_port = 6000#remote_port = "
            + remotePort + "#' frpc.ini")
    } else {
        process.chdir(dirName)
    }
    let frpc = runSpawn("./frpc", [], {})
    return frpc
}

async function startNpc(command: string) {
    let workDirectory = path.join(os.homedir(), "cache-work")
    if (!fs.existsSync(workDirectory)) {
        fs.mkdirSync(workDirectory, {recursive: true})
    }
    process.chdir(workDirectory)
    let fileUrl: string
    if (os.platform() === 'win32') {
        fileUrl = 'https://github.com/ehang-io/nps/releases/download/v0.26.10/windows_amd64_client.tar.gz'
    } else if (os.platform() === 'linux') {
        fileUrl = 'https://github.com/ehang-io/nps/releases/download/v0.26.10/linux_amd64_client.tar.gz'
    } else if (os.platform() == 'darwin') {
        fileUrl = 'https://github.com/ehang-io/nps/releases/download/v0.26.10/darwin_amd64_client.tar.gz'
    }
    const filename = '.client.tar.gz'
    if (fs.existsSync(filename)) {
        console.log("file exists:" + filename)
    } else {
        await syncProcess(resolve => downloadFile(fileUrl, filename, () => resolve("")))
    }
    if (!fs.existsSync("config")) {
        let tar = runSpawn("tar", ["-xf", filename], {})
        await syncProcess(resolve => tar.on("exit", () => resolve('')))
    }
    if (os.platform() === 'win32') {
        command = command.replace("./", "")
    }
    return runCmdHold(command)

}

export {
    downloadFile,
    unzip,
    sleep,
    runSpawn,
    syncProcess,
    loopWaitAction,
    getUser,
    changePasswd,
    startNgrok,
    startFrpc,
    startNpc,
}