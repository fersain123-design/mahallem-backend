"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLayout = void 0;
const mailTemplate_1 = require("../../../utils/mailTemplate");
const createLayout = (content) => {
    return (0, mailTemplate_1.buildMailTemplate)({ content });
};
exports.createLayout = createLayout;
