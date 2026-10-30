// jsdom 没有原生 dialog API；浏览器 E2E 仍验证真实模态与焦点行为。
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function () { this.open = true; };
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function () { this.open = false; };
