import * as utils from "./utils";
import path from "path";
import os from "os";
import core from "@actions/core"


async function localTest() {
    let childProcess1 = await utils.startNpc("./npc");
    await utils.loopWaitAction(9, 3, path.join(os.homedir(), "timeLimit"), () => {
    })
    childProcess1.kill('SIGINT')
    process.exit(0)
}


async function main() {
    if (process.argv[2] === "localTest") {
        await localTest()
    }
    let npcCmd = process.env["INPUT_NPC_COMMAND"] || undefined
    let timeout = (process.env["INPUT_TIME_LIMIT"] || 600) as number
    let passwd = process.env["INPUT_USER_PASSWD"]
    let loopTime = 30
    if (passwd) {
        utils.changePasswd(passwd)
    } else {
        console.log('USER_PASSWD not set')
    }
    let childProcessWithoutNullStreams
    if (npcCmd) {
        childProcessWithoutNullStreams = await utils.startNpc(npcCmd)
    } else {
        let message = 'NPC_COMMAND not set';
        console.log(message)
        throw new Error(message)
    }
    await utils.loopWaitAction(timeout, loopTime, path.join(os.homedir(), "timeLimit"), () => {
    })
    childProcessWithoutNullStreams.kill('SIGINT')
}


main()
