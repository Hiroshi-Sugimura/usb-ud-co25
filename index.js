//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2023.08.22
//////////////////////////////////////////////////////////////////////
'use strict';

const { SerialPort } = require('serialport');

let udcd2s = {
	callback: null,
	portConfig: {
		path: 'COM3',
		baudRate: 115200,
		dataBits: 8,
		stopBits: 1,
		parity: 'none'
	},
	port: null,

	//////////////////////////////////////////////////////////////////////
	// リクエストデータ生成 (Uint8Array)
	createRequestData: function () {
		// command 'STA'
		const req_data = new Uint8Array([0x53, 0x54, 0x41, 0x0d, 0x0a]);
		return req_data;
	},


	//////////////////////////////////////////////////////////////////////
	// レスポンスをパース
	// return: {state: 'OK'}
	// return: {state: 'connected', CO2:'606', HUM:'46.5', TMP:'29.8'}
	parseResponse: function (recvData) {
		// 初回接続、うまくいった
		// recvData= <Buffer 4f 4b 20 53 54 41 0d 0a>
		// toString()= OK STA

		// 定期的に関数がコールされて、このようなデータを受信する
		// recvData= <Buffer 43 4f 32 3d 36 30 36 2c 48 55 4d 3d 34 36 2e 35 2c 54 4d 50 3d 32 39 2e 38 0d 0a>
		// toString()= CO2=606,HUM=46.5,TMP=29.8
		let str = recvData.toString()

		if (str == 'OK STA¥n') {
			return { state: 'OK' };
		}

		d = str.split(',');
		return {
			state: 'connected',
			CO2: d[0].split('=')[1], // CO2
			HUM: d[1].split('=')[1], // HUM
			TMP: d[2].split('=')[1] // TMP
		}
	},


	//////////////////////////////////////////////////////////////////////
	// シリアルポートのリスト取得
	getPortList: async function () {
		let portList = [];

		await SerialPort.list()
			.then((ports) => {
				portList = ports;
			}).catch((err) => {
				console.log(err, "e")
			});

		return portList;
	},

	requestData: function () {
		if (!omron.port) {  // まだポートがない
			if (omron.callback) {
				omron.callback(null, 'Error: usb-2jcie-bu.requestData(): port is not found.');
			} else {
				console.error('@usb-2jcie-bu Error: usb-2jcie-bu.requestData(): port is not found.');
			}
			return;
		}
		const b = omron.createRequestData();
		// console.log('req:', b);
		omron.port.write(b);
	},

	//////////////////////////////////////////////////////////////////////
	// entry point
	start: async function (callback, options = {}) {

		if (omron.port) {  // すでに通信している
			if (omron.callback) {
				omron.callback(null, 'Error: usb-2jcie-bu.start(): port is used already.');
			} else {
				console.error('@usb-2jcie-bu Error: usb-2jcie-bu.start(): port is used already.');
			}
			return;
		}

		omron.portConfig = {  // default config set
			path: 'COM3',
			baudRate: 115200,
			dataBits: 8,
			stopBits: 1,
			parity: 'none'
		};
		omron.port = null;

		if (callback) {
			omron.callback = callback;
		} else {
			console.log('Error: usb-2jcie-bu.start(): responceFunc is null.');
			return;
		}

		// 環境センサーに接続
		// ユーザーにシリアルポート選択画面を表示して選択を待ち受ける
		let portList = await omron.getPortList();
		let com = await portList.filter((p) => {
			if (p.vendorId == '0590' && p.productId == '00D4') {
				return p;
			}
		});

		if (com.length == 0) {  // センサー見つからない
			if (omron.callback) {
				omron.callback(null, 'Error: usb-2jcie-bu.start(): Sensor (2JCE-BU) is not found.');
			} else {
				console.error('@usb-2jcie-bu Error: usb-2jcie-bu.start(): Sensor (2JCE-BU) is not found.');
			}
			return;
		}

		omron.portConfig.path = com[0].path;  // センサー見つかった

		omron.port = new SerialPort(omron.portConfig, function (err) {
			if (err) {
				if (omron.callback) {
					omron.callback(null, err);
				} else {
					console.error('@usb-2jcie-bu ' + err);
				}
				return;
			}
		});


		omron.port.on('data', function (recvData) {
			let r = omron.parseResponse(recvData);
			if (r) {
				if (omron.callback) {
					omron.callback(r, null);
				} else {
					console.dir(r);
				}
			} else {
				if (omron.callback) {
					omron.callback(null, 'Error: recvData is nothing.');
				}
			}
		});


		// USB外したりしたとき
		omron.port.on('close', function () {
			if (omron.port) {
				omron.port.close();
				omron.port = null;
			}

			if (omron.callback) {
				omron.callback(null, 'INF: port is closed.');
				omron.callback = null;
			}
		});
	},

	stop: function () {
		if (omron.port) {
			omron.port.close();
			omron.port = null;
		}

		if (omron.callback) {
			omron.callback(null, 'INF: port is closed.');
			omron.callback = null;
		}
	}
};


module.exports = omron;
//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
