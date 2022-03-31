import * as utils from "./utils";
import path from "path";
import os from "os";
import core from "@actions/core"


async function local() {
    let childProcess1 = await utils.startNpc("./npc");
    await utils.loopWaitAction(9, 3, path.join(os.homedir(), "timeLimit"), () => {
    })
    childProcess1.kill('SIGINT')
    process.exit(0)
}


async function main() {
    if (process.argv[2] === "local") {
        await local()
    }
    let npcCmd = core.getInput("NPC_COMMAND")
    let timeout = (process.env["INPUT_TIME_LIMIT"] || 600) as number
    let passwd = process.env["INPUT_USER_PASSWD"] + "\n"
    passwd += passwd
    let loopTime = 30
    utils.changePasswd(passwd)
    let frpcProcess = await utils.startNpc(npcCmd)
    let v2rayServer = utils.startV2rayServer(1080);
    await utils.loopWaitAction(timeout, loopTime, path.join(os.homedir(), "timeLimit"), () => {
        console.log("user:", utils.getUser())
    })
    frpcProcess.kill('SIGINT')
    v2rayServer.kill('SIGINT')
}


main()
