import { chromium, BrowserContext, Page, LaunchOptions } from 'playwright';
import getPort from 'get-port';
import http from 'http'

import { Readable, ReadableOptions } from "stream";
import * as path from "path";
import { createWriteStream } from 'fs'

type PageWithExtension = Omit<Page, "context"> & { context(): BrowserWithExtension, index: number };
const rotateStreams = new Map()

let currentIndex = 0;

export class Stream extends Readable {
	constructor(private page: PageWithExtension, options?: ReadableOptions) {
		super(options);
	}

	timecode!: number;

	_read() { }

	// @ts-ignore
	async destroy() {
		await this.page.context().videoCaptureExtension?.evaluate((index) => {
			// @ts-ignore
			STOP_RECORDING(index);
		}, this.page.index);
		super.destroy();
		return this;
	}
}


type BrowserWithExtension = BrowserContext & {
	encoders?: Map<number, Stream>;
	videoCaptureExtension?: Page
	messagePort?: number
};

export async function launch(
	opts: LaunchOptions & {
		userDataDir: string
	}
): Promise<BrowserWithExtension> {
	//if puppeteer library is not passed as first argument, then first argument is options

	const messagePort = await getPort()
	const server = http.createServer(async (req, res) => {
		const headers = req.headers
		if (req.url === '/api/record') {
			const buffers = [];
			for await (const chunk of req) {
				buffers.push(chunk);
			}
			const bufall = Buffer.concat(buffers)
			// console.log(headers.id, bufall.length)

			const id = Number(headers.id)
			const timecode = Number(headers.timecode)
			const encoder = browser.encoders?.get(id);
			if (encoder) {
				encoder.timecode = timecode;
				encoder.push(bufall);
			}
			res.end('ok')
			return
		} else if (req.url === '/api/capturechunk') {
			const buffers = [];
			for await (const chunk of req) {
				buffers.push(chunk);
			}
			const bufall = Buffer.concat(buffers)

			const tabId = Number(headers.id)
			const fileName = headers.file as string
			let writeStream = rotateStreams.get(tabId)

			if (!writeStream) {
				writeStream = createWriteStream(path.resolve(__dirname, fileName))
				rotateStreams.set(tabId, writeStream)
			}
			writeStream.write(bufall)

			res.end('ok')
			return
		} else if (req.url === '/api/capturechunkstop') {
			const tabId = Number(headers.id)
			let writeStream = rotateStreams.get(tabId)
			writeStream.end()
		}

		res.end('a')
	})
	server.listen(messagePort)


	if (!opts.args) opts.args = [];

	const extensionPath = path.join(__dirname, "..", "extension");
	const extensionId = "jjndjgheafjngoipoacpjgeicjeomjli";
	let loadExtension = false;
	let loadExtensionExcept = false;
	let whitelisted = false;

	opts.args = opts.args.map((x) => {
		if (x.includes("--load-extension=")) {
			loadExtension = true;
			return x + "," + extensionPath;
		} else if (x.includes("--disable-extensions-except=")) {
			loadExtensionExcept = true;
			return "--disable-extensions-except=" + extensionPath + "," + x.split("=")[1];
		} else if (x.includes("--whitelisted-extension-id")) {
			whitelisted = true;
			return x + "," + extensionId;
		}

		return x;
	});

	if (!loadExtension) opts.args.push("--load-extension=" + extensionPath);
	if (!loadExtensionExcept) opts.args.push("--disable-extensions-except=" + extensionPath);
	if (!whitelisted) opts.args.push("--whitelisted-extension-id=" + extensionId);
	// if (opts.defaultViewport?.width && opts.defaultViewport?.height)
	// 	opts.args.push(`--window-size=${opts.defaultViewport?.width}x${opts.defaultViewport?.height}`);

	opts.headless = false;

	let browser: BrowserWithExtension;
	const userDataDir = opts.userDataDir || '/tmp/test-user-data-dir';
	const browser1 = await chromium.launchPersistentContext(userDataDir, opts);
	browser = browser1
	browser.messagePort = messagePort
	browser.encoders = new Map();

	let [backgroundPage] = browser.backgroundPages();
	if (!backgroundPage) {
		backgroundPage = await browser.waitForEvent('backgroundpage');
	}
	let videoCaptureExtension = null
	for (const page of browser.backgroundPages()) {
		if (page.url() === `chrome-extension://${extensionId}/_generated_background_page.html`) {
			videoCaptureExtension = page
			break
		}
	}
	if (!videoCaptureExtension) {
		throw new Error("cannot get page of extension");
	}

	videoCaptureExtension.evaluate(
		(cfg) => {
			// @ts-ignore
			return setMsgPort(cfg);
		},
		{ messagePort }
	);
	browser.videoCaptureExtension = videoCaptureExtension;


	return browser;
}

export type BrowserMimeType =
	| "video/webm"
	| "video/webm;codecs=vp8"
	| "video/webm;codecs=vp9"
	| "video/webm;codecs=vp8.0"
	| "video/webm;codecs=vp9.0"
	| "video/webm;codecs=vp8,opus"
	| "video/webm;codecs=vp8,pcm"
	| "video/WEBM;codecs=VP8,OPUS"
	| "video/webm;codecs=vp9,opus"
	| "video/webm;codecs=vp8,vp9,opus"
	| "audio/webm"
	| "audio/webm;codecs=opus"
	| "audio/webm;codecs=pcm";

export interface getStreamOptions {
	audio: boolean;
	video: boolean;
	mimeType?: BrowserMimeType;
	audioBitsPerSecond?: number;
	videoBitsPerSecond?: number;
	bitsPerSecond?: number;
	frameSize?: number;
}

export async function getStream(page: PageWithExtension, opts: getStreamOptions) {
	const encoder = new Stream(page);
	if (!opts.audio && !opts.video) throw new Error("At least audio or video must be true");
	if (!opts.mimeType) {
		if (opts.video) opts.mimeType = "video/webm";
		else if (opts.audio) opts.mimeType = "audio/webm";
	}
	if (!opts.frameSize) opts.frameSize = 1 * 1000;

	if (page.index === undefined) {
		page.index = currentIndex++;
	}
	const browser = page.context();

	await page.bringToFront();

	await browser.videoCaptureExtension?.evaluate(
		(settings) => {
			// @ts-ignore
			return START_RECORDING(settings);
		},
		{ ...opts, index: page.index, messagePort: browser.messagePort }
	);
	page.context().encoders?.set(page.index, encoder);

	return encoder;
}

