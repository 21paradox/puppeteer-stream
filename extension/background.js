// @ts-nocheck
/* global chrome, MediaRecorder, FileReader */




const recorders = new Map()
let messagePort = 0
function setMsgPort(cfg) {
	messagePort = cfg.messagePort
}


function START_RECORDING({ index, video, audio, frameSize, audioBitsPerSecond, videoBitsPerSecond, bitsPerSecond, mimeType, videoConstraints, autoStopTime }) {
	console.log({index, video, audio, frameSize})

	return new Promise((resolve, reject) => {
		chrome.tabCapture.capture(
			{
				audio,
				video,
				videoConstraints
			},
			(stream) => {
				if (!stream) {
					console.log('no stream')
					reject(1)
					return
				}

				const recorder = new MediaRecorder(stream, {
					ignoreMutedMedia: true,
					// audioBitsPerSecond,
					// videoBitsPerSecond,
					// bitsPerSecond,
					mimeType,
				});
				recorders.set(index, recorder)
				// recorders[index] = recorder;
				// TODO: recorder onerror

				recorder.ondataavailable = async function (event) {
					if (event.data.size > 0) {
						const buffer = await event.data.arrayBuffer();
						// const data = arrayBufferToString(buffer);
						fetch(`http://127.0.0.1:${messagePort}/api/record`, {
							method: 'POST',
							body: buffer,
							headers: {
								id: index,
								timecode: event.timecode
							}
						})
					}
				};
				recorder.onerror = () => recorder.stop();

				recorder.onstop = function () {
					try {
						const tracks = stream.getTracks();

						tracks.forEach(function (track) {
							track.stop();
						});
					} catch (error) { }
				};
				stream.oninactive = () => {
					try {
						recorder.stop();
					} catch (error) { }
				};

				recorder.start(frameSize);

				if (autoStopTime) {
					setTimeout(() => {
						recorder.stop()
					}, 60 * 1000 * autoStopTime)
				}
				resolve(0)
			}
		);
	})
}


function captureByIndex(fileName, index, time) {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({}, (tabList) => {
			let curTab = tabList[index]
			if (!curTab) {
				for (const tab of tabList) {
					if(tab.id === index) {
						curTab = tab
						break
					}
				}
			}
			if (!curTab) {
				throw new Error('no curTab')
			}
			console.log('record', curTab.url, curTab.title);

			const frameSize = 5 * 1000;

			chrome.tabCapture.capture(
				{
					audio: true,
					video: true,
				},
				(stream) => {
					if (!stream) {
						reject(1)
						return
					}
					const recorder = new MediaRecorder(stream, {
						ignoreMutedMedia: true,
						mimeType: 'video/webm',
					});

					recorder.ondataavailable = async function (event) {
						if (event.data.size > 0) {
							const buffer = await event.data.arrayBuffer();
							// const data = arrayBufferToString(buffer);
							fetch(`http://127.0.0.1:${messagePort}/api/capturechunk`, {
								method: 'POST',
								body: buffer,
								headers: {
									// index: index,
									id: curTab.id,
									file: fileName,
									timecode: event.timecode
								}
							})
						}
					};
					recorder.onerror = () => recorder.stop();

					recorder.onstop = function () {
						fetch(`http://127.0.0.1:${messagePort}/api/capturechunkstop`, {
							method: 'get',
							headers: {
								id: curTab.id,
								file: fileName,
							}
						})
						
						try {
							const tracks = stream.getTracks();

							tracks.forEach(function (track) {
								track.stop();
							});
						} catch (error) { }
					};
					stream.oninactive = () => {
						try {
							recorder.stop();
						} catch (error) { }
					};

					recorder.start(frameSize);

					setTimeout(() => {
						// todo stream
						console.log('record stop', curTab.url, curTab.title, stream);
						recorder.stop()
					}, 60 * 1000 * time)
					resolve(0)
				}
			);
		})
	})
}

function STOP_RECORDING(index) {
	//chrome.extension.getBackgroundPage().console.log(recorders)
	// if (!recorders[index]) return;
	const r = recorders.get(index)
	if (r) {
		r.stop()
	}
	recorders.delete(index)
	// recorders[index].stop();
	// delete recorders[index]
}

function arrayBufferToString(buffer) {
	// Convert an ArrayBuffer to an UTF-8 String

	var bufView = new Uint8Array(buffer);
	var length = bufView.length;
	var result = "";
	var addition = Math.pow(2, 8) - 1;

	for (var i = 0; i < length; i += addition) {
		if (i + addition > length) {
			addition = length - i;
		}
		result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition));
	}
	return result;
}


