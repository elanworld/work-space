import * as utils from "./utils";
import path from "path";
import os from "os";
import fs from "fs";
import childProcess from "child_process";


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
        await utils.syncProcess(resolve => utils.downloadFile(fileUrl, filename, () => resolve("")))
    }
    if (!fs.existsSync(dirName)) {
        let tar = utils.runSpawn("tar", ["-xf", filename], {})
        await utils.syncProcess(resolve => tar.on("exit", () => resolve('')))
        process.chdir(dirName)
        childProcess.execSync("sed -i -e 's#server_addr = 127.0.0.1#server_addr = "
            + server + "#' -e 's#remote_port = 6000#remote_port = "
            + remotePort + "#' frpc.ini")
    } else {
        process.chdir(dirName)
    }
    let frpc = utils.runSpawn("./frpc", [], {})
    return frpc
}

async function local() {
    let frpcProcess = await startFrpc("xianneng.top", 10027);
    await utils.loop(60 * 60 * 4, 30, path.join(os.homedir(), "timeLimit"), () => {
    })
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
    utils.changePasswd(passwd)
    utils.startV2rayServer(10086)
    utils.forwardPort(10086,10024,serverHost)
    await utils.loop(timeout, loopTime, path.join(os.homedir(), "timeLimit"), () => {
    })
    frpcProcess.kill('SIGINT')
}


main()
