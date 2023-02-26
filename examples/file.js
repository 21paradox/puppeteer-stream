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
		executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
		args: [
			'--headless=new',
			`--remote-debugging-port=8088`
		]
	});

	await browser.videoCaptureExtension.exposeFunction("recordBilibili", async (url, fileName, time) => {
		console.log("begin", url, fileName, time);
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

		setTimeout(async () => {
			await recordStream.destroy();
			writeStream.close();
			console.log("finished", url, fileName, time);
			// await page.close()
		}, 60 * 1000 * time);
	});

}

test();
