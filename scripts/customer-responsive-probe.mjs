import { writeFile } from "node:fs/promises";

const [, , port = "9223", width = "320", height = "568", screenshotPath] =
  process.argv;

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) =>
  response.json(),
);
const target = targets.find(
  (entry) => entry.type === "page" && entry.url.includes("/customer"),
);

if (!target) {
  throw new Error("Customer page target not found.");
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);

  if (!request) {
    return;
  }

  pending.delete(message.id);

  if (message.error) {
    request.reject(new Error(message.error.message));
    return;
  }

  request.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  requestId += 1;

  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}

await send("Emulation.setDeviceMetricsOverride", {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: Number(width) < 768,
});
await send("Runtime.evaluate", {
  expression: "new Promise((resolve) => setTimeout(resolve, 1000))",
  awaitPromise: true,
});

const result = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `JSON.stringify((() => {
    const visibleElements = [...document.querySelectorAll("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    const overflow = visibleElements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > innerWidth + 1 || rect.left < -1;
      })
      .slice(0, 40)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: String(element.className).slice(0, 160),
          text: (element.textContent || "").trim().slice(0, 100),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      });
    const customerHeader = document.querySelector(".customer-nav")?.getBoundingClientRect();
    const headerButtons = [...document.querySelectorAll(".customer-nav button")].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: (element.textContent || "").trim(),
        label: element.getAttribute("aria-label"),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        visible: rect.right > 0 && rect.left < innerWidth,
      };
    });
    return {
      innerWidth,
      innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      customerHeader: customerHeader
        ? {
            left: Math.round(customerHeader.left),
            right: Math.round(customerHeader.right),
            width: Math.round(customerHeader.width),
          }
        : null,
      headerButtons,
      overflow,
    };
  })())`,
});

console.log(result.result.value);

if (screenshotPath) {
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

socket.close();
