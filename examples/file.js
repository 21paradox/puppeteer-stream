const { 
	launch 
} = require('../dist/PuppeteerStream')

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
	console.log('running')
}

test();
