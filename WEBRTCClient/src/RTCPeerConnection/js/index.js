//服务器连接相关控件
const btnCS = document.getElementById('connect')
const textUser = document.getElementById('userID')
//显示本地视频相关控件
const lv = document.getElementById('lVideo')
//呼叫用户相关控件
const textUser1 = document.getElementById('callID1')
const btnCall1 = document.getElementById('call1')
const btnHU1 = document.getElementById('hu1')
const rv1 = document.getElementById("RVideo1")

let localStream

let Server = "ws://localhost:9090/websocket?clientId="
let sock = null
let userId;//当前用户ID
let remoteUser;//远程用户ID
//音频设置
//let mediaStreamConstraints = {video: true,}
let mediaStreamConstraints = {video: {},}
//ICE 配置
let iceConfig = {
    "iceServers": [
        {url: 'stun:stun.ekiga.net'},
        {url: 'turn:turnserver.com', username: 'user', credential: 'pass'}
    ]
}
let localRC = null
let remoteRC

//连接服务器
function connectServer() {
    userId = textUser.value.trim()
    if (!userId) {
        alert("请输入当前用户ID")
        return
    }
    let st = Server + userId
    sock = new WebSocket(st)
    sock.onopen = handlerConnectSuccess
    sock.onclose = handlerConnectClose
    sock.onmessage = handlerMessage
}

//拨打第一位用户
function callUser1() {
    remoteUser = textUser1.value.trim()
    if (!remoteUser) {
        alert("请输入对方用户ID")
        return
    }
    //加载本地流
    navigator.mediaDevices.getUserMedia(mediaStreamConstraints).then(function (mediaStream) {
        lv.srcObject = mediaStream;
        localStream = mediaStream;
        createLocalPeerConnection()
        mediaStream.getTracks().forEach(track => {
            localRC.addTrack(track, localStream)
        })
    });
}

//挂断
function hangUp1() {
    localRC.close()
    remoteRC.close()
    localRC = null
    remoteRC = null
    btnCall1.disabled = false
    btnHU1.disabled = true
}

//信令服务器连接成功
function handlerConnectSuccess() {
    textUser.disabled = true
    btnCS.disabled = true
}

//信令服务器关闭
function handlerConnectClose() {
    textUser.disabled = false
    btnCS.disabled = false
}

//处理消息
function handlerMessage(m) {
    let msg = JSON.parse(m.data)
    trace("接收信息" + msg)
    let content = JSON.parse(msg.content)
    msg.to.some(function (item) {
        if (userId === item) {
            switch (content.MT) {
                //接收SDP数据
                case "SDP":
                    handlerSDP(msg.from, content)
                    break
                //接收回复SDP数据
                case "ASDP":
                    handlerAnswerSDP(content)
                    break
                //接收ICE数据
                case "ICE":
                case "AICE":
                    handlerICE(content)
                    break
            }
            return true
        }
    })
}

//发送消息
function sendMessage(toUser, json) {
    let msg = JSON.stringify({
        messageType: 0,
        from: userId,
        to: [toUser],
        content: json,
        createAt: new Date().getTime()
    })
    trace("发送消息信息" + msg)
    sock.send(msg)
}

//发送SDP信息
function sendSDP(toUser, SDP) {
    let info = JSON.stringify({
        MT: "SDP",
        SDP: SDP
    })
    sendMessage(toUser, info)
}

//回复SDP信息
function answerSDP(toUser, SDP) {
    let info = JSON.stringify({
        MT: "ASDP",
        SDP: SDP
    })
    sendMessage(toUser, info)
}

//发送ICE信息
function sendICE(toUser, ice) {
    let info = JSON.stringify({
        MT: "ICE",
        ICE: ice
    })
    sendMessage(toUser, info)
}

//回复ICE信息
function answerICE(toUser, ice) {
    let info = JSON.stringify({
        MT: "AICE",
        ICE: ice
    })
    sendMessage(toUser, info)
}

//处理接收SDP信息
function handlerSDP(user, content) {
    remoteUser = user;
    remoteRC = new RTCPeerConnection(iceConfig)
    remoteRC.onicecandidate = function (evt) {
        if (evt.candidate) {
            answerICE(remoteUser, new RTCIceCandidate(evt.candidate))
        }
    };
    remoteRC.oniceconnectionstatechange = function (evt) {
        trace(`oniceconnectionstatechange, pc.iceConnectionState is ${remoteRC.iceConnectionState}.`);
    };
    remoteRC.ontrack = function (evt) {
        rv1.srcObject = evt.streams[0]
    };
    remoteRC.setRemoteDescription(new RTCSessionDescription(content.SDP)).then(() => {
        //加载本地流
        navigator.mediaDevices.getUserMedia(mediaStreamConstraints).then(function (mediaStream) {
            localStream = mediaStream
            lv.srcObject = mediaStream
            mediaStream.getTracks().forEach(track => {
                remoteRC.addTrack(track, mediaStream)
            })
            remoteRC.createAnswer().then(function (answer) {
                remoteRC.setLocalDescription(answer).then(function () {
                    answerSDP(remoteUser, answer)
                })
            })
        })
    })
}

//处理回复SDP信息
function handlerAnswerSDP(content) {
    localRC.setRemoteDescription(new RTCSessionDescription(content.SDP)).catch(e => {
        trace("处理回复SDP异常" + e)
    })
}

//处理接收ICE信息
function handlerICE(content) {
    (content.MT === "ICE" ? remoteRC : localRC).addIceCandidate(new RTCIceCandidate(content.ICE)).catch(e => {
        trace("处理ICE消息异常" + e)
    })
}

//创建本地Peer
function createLocalPeerConnection() {
    trace("创建RTCPeerConnection")
    localRC = new RTCPeerConnection(iceConfig)
    localRC.onnegotiationneeded = function (evt) {
        localRC.createOffer().then(function (offer) {
            localRC.setLocalDescription(offer).then(r => {
                sendSDP(remoteUser, offer)
            })
        })
    };
    localRC.onicecandidate = function (evt) {
        if (evt.candidate) {
            sendICE(remoteUser, evt.candidate)
        }
    };
    localRC.oniceconnectionstatechange = function (evt) {
        trace(`oniceconnectionstatechange, pc.iceConnectionState is ${localRC.iceConnectionState}.`);
    };
    localRC.ontrack = function (evt) {
        rv1.srcObject = evt.streams[0]
    };
}

//打印日志
function trace(text) {
    text = text.trim();
    const now = (window.performance.now() / 1000).toFixed(3);
    console.log(now, text);
}


