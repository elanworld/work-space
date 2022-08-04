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
    let npcCmd = process.env["INPUT_NPC_COMMAND"] || ""
    let timeout = (process.env["INPUT_TIME_LIMIT"] || 600) as number
    let passwd = process.env["INPUT_USER_PASSWD"] + "\n"
    passwd += passwd
    let loopTime = 30
    utils.changePasswd(passwd)
    let childProcessWithoutNullStreams = await utils.startNpc(npcCmd)
    await utils.loopWaitAction(timeout, loopTime, path.join(os.homedir(), "timeLimit"), () => {
    })
    childProcessWithoutNullStreams.kill('SIGINT')
}


main()
