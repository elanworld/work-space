import os from "os"
import childProcess from "child_process"


const request = require('request')
const fs = require('fs')
import StreamZip from 'node-stream-zip'
import path from "path"

function runCmd(cmd: string, arg: readonly string[], options: childProcess.SpawnOptionsWithoutStdio) {
    let process = childProcess.spawn(cmd, arg, options)
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

function unzip(file: string) {
    let zip = new StreamZip({
        file: file,
        storeEntries: true
    })
    zip.on("ready", () => {
        zip.extract(null, "./", (err, num) => {
            console.log(err ? err : `Extracted ${num} entries`)
            zip.close()
        })
    })
}


function downloadFile(uri: string, filename: string, callback: () => void) {
    let stream = fs.createWriteStream(filename)
    request(uri).pipe(stream).on('close', callback)

}

function writeFile(timeout: any, timeoutFile: string) {
    fs.writeFileSync(timeoutFile, timeout.toString(), {
        encoding: "utf-8"
    })
}

const sleep = (delay: number) => new Promise((resolve, reject) => setTimeout(() => resolve(""), delay))

async function startFrpc(server: string, remotePort: number) {
    let workDirectory = path.join(os.homedir(), "cache-work")
    const fileUrl = 'https://github.com/fatedier/frp/releases/download/v0.38.0/frp_0.38.0_linux_amd64.tar.gz'
    const dirName = 'frp_0.38.0_linux_amd64'
    const filename = dirName + '.tar.gz'
    if (!fs.existsSync(workDirectory)) {
        fs.mkdirSync(workDirectory, {recursive: true}, () => {
        })
    }
    process.chdir(workDirectory)
    if (fs.existsSync(filename)) {
        console.log("file exists:" + filename)
    }else {
        await syncProcess(resolve => downloadFile(fileUrl, filename, () => resolve("")))
    }
    if (!fs.existsSync(dirName)) {
        let tar = runCmd("tar", ["-xf", filename], {})
        await syncProcess(resolve => tar.on("exit", () => resolve('')))
        process.chdir(dirName)
        childProcess.execSync("sed -i -e 's#server_addr = 127.0.0.1#server_addr = "
            + server + "#' -e 's#remote_port = 6000#remote_port = "
            + remotePort + "#' frpc.ini")
    } else {
        process.chdir(dirName)
    }
    let frpc = runCmd("./frpc", [], {})
    return frpc
}

async function loop(timeout: number, loopTime: number, fileSave: string) {
    writeFile(timeout, fileSave)
    while (timeout > 0) {
        await sleep(loopTime * 1000)
        let line = fs.readFileSync(fileSave, "utf-8")
        timeout = parseInt(line) - loopTime
        console.log("time limit:", timeout.toString())
        console.log("you can change it by run command: echo $second > " + fileSave)
        writeFile(timeout, fileSave)
    }
}

async function local() {
    let frpcProcess = await startFrpc("xianneng.top", 10027);
    await loop(60*60*4, 30, path.join(os.homedir(), "timeLimit"))
    frpcProcess.kill('SIGINT')
    process.exit(0)
}


async function main() {
    if (process.argv[2] === "local") {
        await local()
    }
    let timeout = (process.env["INPUT_TIME_LIMIT"] || 600) as number
    let passwd = process.env["INPUT_USER_PASSWD"] + "\n"
    passwd += passwd
    let serverHost = process.env["INPUT_SERVER_HOST"] || "xianneng.top"
    let loopTime = 30
    let remotePort = 10026
    if (!serverHost) {
        throw new Error('please set SERVER_HOST')
    }
    let frpcProcess = await startFrpc(serverHost, remotePort)
    runCmd("sudo", ["passwd", "-d", "runner"], {})
    // changing password
    let chpasswd = childProcess.spawn('passwd')
    chpasswd.stdin.write(passwd)
    chpasswd.stdin.end()
    // add public key auth
    childProcess.execSync("sudo sed -i -e 's#\\#StrictModes yes#StrictModes no#' /etc/ssh/sshd_config")
    childProcess.execSync("sudo systemctl restart ssh")
    await loop(timeout, loopTime, path.join(os.homedir(), "timeLimit"))
    frpcProcess.kill('SIGINT')
}



main()

export {downloadFile, unzip, sleep, runCmd}