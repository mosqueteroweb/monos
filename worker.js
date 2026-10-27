importScripts("logger.js", "sim.js");

const controller = MonosSim.createController((message, transfer) =>
  self.postMessage(message, transfer || []),
);

self.onmessage = (e) => controller.handle(e.data);
