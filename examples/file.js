const {
	launch,
	getStream
} = require('../dist/PuppeteerStream')
const fs = require('fs')
const path = require('path')

async function test() {
	const browser = await launch({
		defaultViewport: {
			width: 1920,
			height: 1080,
		},
		userDataDir: '/tmp/test-user-data-dir',
		executablePath: process.env.chromebin || '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
		args: [
			'--headless=new',
			`--remote-debugging-port=8088`
		]
	});

	await browser.videoCaptureExtension.exposeFunction("recordBilibili", async (url, fileName, time) => {
		console.log("begin recordBilibili", url, fileName, time);
		const page = await browser.newPage();
		await page.goto(url);

		if (page.locator('.bpx-player-ctrl-muted-icon').isVisible()) {
			page.getByRole('button', { name: '音量', exact: true }).click()
		}
		page.getByRole('button', { name: '全屏', exact: true }).click()

		const recordStream = await getStream(page, {
			audio: true,
			video: true,
			frameSize: 5 * 1000
		})
		const writeStream = fs.createWriteStream(path.resolve(__dirname, fileName))
		recordStream.pipe(writeStream)
		page.once('close', async () => {
			recordStream.destroy()
			writeStream.close()
		})

		setTimeout(async () => {
			await recordStream.destroy();
			writeStream.close();
			console.log("finished", url, fileName, time, new Date());
			// await page.close()
		}, 60 * 1000 * time);
	});

	await browser.videoCaptureExtension.exposeFunction("recordBilibiliLive", async (url, fileName, time) => {
		console.log("begin recordBilibiliLive", url, fileName, time, new Date());
		const page = await browser.newPage();
		await page.goto(url);

		try {
			const quickvol = page.getByText('点击取消静音')
			await quickvol.click()
		} catch (e) {
			console.log('unsilent failed')
		}

		// try {
		// 	await page.mouse.click(800, 500);
		// 	let stopMouseclick
		// 	let sid = setInterval(() => {
		// 		if (stopMouseclick) {
		// 			clearInterval(sid)
		// 			return
		// 		}
		// 		if (!page.isClosed()) {
		// 			page.mouse.click(800, 500);
		// 		}
		// 	}, 2000)
			
		// 	const $fullScreen = page.locator('#player_fullpage')
		// 	await $fullScreen.click()
		// 	stopMouseclick = true
		// } catch (e) {
		// 	stopMouseclick = true
		// 	console.log('fullpage failed')
		// }

		let sid = setInterval(async () => {
			const chargeItemVisible = await page.getByText('充值商店').isVisible()
			if (chargeItemVisible) {
				const closeBtns = page.locator('.icon-close.p-absolute.pointer')
				for (const closeButton of await closeBtns.all()) {
					if (await closeButton.isVisible()) {
						await closeButton.click()
						console.log('button charge closed')
						break
					}
				}
			}
		}, 6 * 1000)
		page.once('close', () => {
				clearInterval(sid)
		})

		const recordStream = await getStream(page, {
			audio: true,
			video: true,
			frameSize: 5 * 1000
		})
		// const writeStream = fs.createWriteStream(path.resolve(__dirname, '../dist/', fileName))
		const writeStream = fs.createWriteStream(path.resolve('/root/bilibili-live/', fileName))
		recordStream.pipe(writeStream)
		page.once('close', async () => {
			recordStream.destroy()
			writeStream.close()
		})


		setTimeout(async () => {
			await recordStream.destroy();
			writeStream.close();
			console.log("finished", url, fileName, time, new Date());
			await page.close()
		}, 60 * 1000 * time);
	});

	browser.on('page', (page) => {
		// const fileChooserPromise = page.waitForEvent('filechooser');
		let currentFileChooser = null
		page.exposeFunction("__chooseFile", async (filePath) => {
			if (currentFileChooser) {
				console.log(filePath)
				await currentFileChooser.setFiles(filePath);
			}
		});
		page.on('filechooser', async fileChooser => {
			currentFileChooser = fileChooser
			page.evaluate(() => {
				console.log('filechooser clicked')
			})
			// await fileChooser.setFiles();
		});
	})

	await browser.videoCaptureExtension.exposeFunction("recordAny", async (url, fileName, time) => {
		console.log("begin recordany", url, fileName, time, new Date());
		const page = await browser.newPage();
		await page.goto(url);

		const recordStream = await getStream(page, {
			audio: true,
			video: true,
			frameSize: 5 * 1000
		})
		// const writeStream = fs.createWriteStream(path.resolve(__dirname, '../dist/', fileName))
		const writeStream = fs.createWriteStream(path.resolve('/root/bilibili-live/', fileName))
		recordStream.pipe(writeStream)

		page.once('close', async () => {
			recordStream.destroy()
			writeStream.close()
		})

		setTimeout(async () => {
			await recordStream.destroy();
			writeStream.close();
			console.log("finished", url, fileName, time, new Date());
			await page.close()
		}, 60 * 1000 * time);
	});


}

test();
