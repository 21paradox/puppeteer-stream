// @ts-nocheck
/* global chrome, MediaRecorder, FileReader */




const recorders = {};

function START_RECORDING({ index, video, audio, frameSize, audioBitsPerSecond, videoBitsPerSecond, bitsPerSecond, mimeType, videoConstraints, messagePort }) {
	return new Promise((resolve, reject) => {
		chrome.tabCapture.capture(
			{
				audio,
				video,
				videoConstraints
			},
			(stream) => {
				if (!stream) {
					reject(1)
					return
				}

				const recorder = new MediaRecorder(stream, {
					ignoreMutedMedia: true,
					audioBitsPerSecond,
					videoBitsPerSecond,
					bitsPerSecond,
					mimeType,
				});
				recorders[index] = recorder;
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
				resolve(0)
			}
		);
	})
}

function STOP_RECORDING(index) {
	//chrome.extension.getBackgroundPage().console.log(recorders)
	if (!recorders[index]) return;
	recorders[index].stop();
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


