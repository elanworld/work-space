import os from "os";
import childProcess, {ChildProcess} from "child_process"
import core from "@actions/core"

const request = require('request');
const fs = require('fs');
import StreamZip from 'node-stream-zip';
import path from "path";
import {resolve} from "dns";

function runCmd(cmd: string, arg: readonly string[], options: childProcess.SpawnOptionsWithoutStdio) {
    let process = childProcess.spawn(cmd, arg, options)
    process.stdout && process.stdout.on('data', function (data) {
        console.log(data.toString())
    });
    process.stderr && process.stderr.on('data', function (data) {
        console.log(data.toString())
    });
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
    });
    zip.on("ready", () => {
        zip.extract(null, "./", (err, num) => {
            console.log(err ? err : `Extracted ${num} entries`);
            zip.close();
        })
    })
}


/*
* url 网络文件地址
* filename 文件名
* callback 回调函数
*/
function downloadFile(uri: string, filename: string, callback: () => void) {
    let stream = fs.createWriteStream(filename);
    request(uri).pipe(stream).on('close', callback)

}

function writeFile(timeout: any, timeoutFile: string) {
    fs.writeFileSync(timeoutFile, timeout.toString(), {
        encoding: "utf-8"
    })
}

const sleep = (delay: number) => new Promise((resolve, reject) => setTimeout(() => resolve(""), delay))

async function main() {
    let timeout = process.env["INPUT_TIME_LIMIT"] || 600
    let passwd = process.env["INPUT_USER_PASSWD"]
    let serverHost = process.env["INPUT_SERVER_HOST"]
    let loopTime = 20
    let file = path.join(os.homedir(), "timeLimit");
    let workDirectory = path.join(os.homedir(), "cache-work");
    const fileUrl = 'https://github.com/fatedier/frp/releases/download/v0.38.0/frp_0.38.0_linux_arm64.tar.gz';
    const filename = 'frp_0.38.0_linux_arm64.tar.gz';

    writeFile(timeout, file)
    if (!fs.existsSync(workDirectory)) {
        fs.mkdir(workDirectory, { recursive: true }, () => {})
    }
    process.chdir(workDirectory)
    await syncProcess(resolve => downloadFile(fileUrl, filename, () => resolve("")))
    let tar = runCmd("tar", ["-xf", filename], {});
    await syncProcess(resolve => tar.on("close", () => resolve('')))
    process.chdir('./frp_0.38.0_linux_arm64')
    childProcess.execSync("sed -i -e 's#server_addr = 127.0.0.1#server_addr = " + serverHost + "#' -e 's#remote_port = 6000#remote_port = 10026#' frpc.ini")
    // childProcess.execSync("echo -e \"" + passwd + "\\n" + passwd + "\\n\" | sudo passwd \"$USER\"")
    let frpc = runCmd("./frpc", ["-c", "frpc.ini"], {});
    while (timeout > 0) {
        await sleep(loopTime * 1000)
        let line = fs.readFileSync(file, "utf-8");
        timeout = parseInt(line) - loopTime;
        console.log("time limit:", timeout.toString())
        console.log("you can delay by run command echo $time > " + file)
        writeFile(timeout, file)
    }
    frpc.kill("SIGINT")
}

main()

export {downloadFile, unzip, sleep, runCmd}