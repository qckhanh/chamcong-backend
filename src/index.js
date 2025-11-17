"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var axios_1 = require("axios");
var cors_1 = require("cors");
var multer_1 = require("multer");
var convert = require("heic-convert");
// Khởi tạo express app
var app = (0, express_1.default)();
var port = 3001;
// Middleware để parse JSON body và enable CORS
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Cấu hình multer để xử lý file upload
var upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Cache cho endpoint /history và /my-info
var historyCache = new Map();
var myinfoCache = new Map();
var TTL = 5 * 60 * 1000; // 5 phút (TTL tính bằng milliseconds)
// Hàm convert image buffer sang base64 (hỗ trợ JPG, JPEG, HEIC)
var imageToBase64 = function (file) { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                buffer = file.buffer;
                if (!(file.mimetype === 'image/heic')) return [3 /*break*/, 2];
                console.log('Converting HEIC to JPEG');
                return [4 /*yield*/, convert({
                        buffer: file.buffer,
                        format: 'JPEG',
                        quality: 1
                    })];
            case 1:
                buffer = _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/, buffer.toString('base64')];
            case 3:
                err_1 = _a.sent();
                console.error('ERROR in imageToBase64:', err_1.message);
                throw new Error('Failed to convert image to base64');
            case 4: return [2 /*return*/];
        }
    });
}); };
// Hàm tạo headers với apiKey và sessionId từ request headers
var getHeaders = function (req) {
    var apiKey = req.headers['api-key'];
    var sessionId = req.headers['session-id'];
    if (!apiKey || !sessionId) {
        console.log('ERROR: Missing apiKey or sessionId in headers', { apiKey: apiKey, sessionId: sessionId });
        throw new Error('apiKey and sessionId headers are required');
    }
    return {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "apikey": apiKey,
        "Connection": "keep-alive",
        "Cookie": "cids=2; session_id=".concat(sessionId),
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "EnERP/5 CFNetwork/3826.500.131 Darwin/24.5.0"
    };
};
// Endpoint 1: GET / (for testing)
app.get('/', function (req, res) {
    res.status(200).json({ message: 'Hello World' });
});
// Endpoint 2: POST /check-in
// Request body: multipart/form-data with 'image' field (JPG, JPEG, HEIC)
// Headers: api-key, session-id
app.post('/check-in', upload.single('image'), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var header, allowedTypes, base64Image, URL_1, body, response, err_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                header = getHeaders(req);
                if (!req.file) {
                    console.log('ERROR: Missing image file in /check-in request');
                    return [2 /*return*/, res.status(400).json({ error: 'Image file is required' })];
                }
                allowedTypes = ['image/jpeg', 'image/jpg', 'image/heic'];
                if (!allowedTypes.includes(req.file.mimetype)) {
                    console.log('ERROR: Unsupported image format', { mimetype: req.file.mimetype });
                    return [2 /*return*/, res.status(400).json({ error: 'Only JPG, JPEG, and HEIC formats are supported' })];
                }
                return [4 /*yield*/, imageToBase64(req.file)];
            case 1:
                base64Image = _a.sent();
                URL_1 = "https://odoo.entrade.com.vn/hr/check_in";
                body = { params: { image: base64Image } };
                return [4 /*yield*/, axios_1.default.post(URL_1, body, { headers: header })];
            case 2:
                response = _a.sent();
                // Xóa cache sau khi check-in thành công
                console.log('Clearing caches due to successful check-in');
                historyCache.clear();
                myinfoCache.clear();
                res.status(response.status).json(response.data);
                return [3 /*break*/, 4];
            case 3:
                err_2 = _a.sent();
                console.error('ERROR in /check-in:', err_2.message);
                res.status(err_2.message.includes('headers are required') || err_2.message.includes('image') ? 400 : 500).json({ error: err_2.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Endpoint 3: GET /history
// Query params: ?month=10&year=2025
// Headers: api-key, session-id
app.get('/history', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var header, _a, month, year, cacheKey, cached, URL_2, body, response, err_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                header = getHeaders(req);
                _a = req.query, month = _a.month, year = _a.year;
                if (!month || !year) {
                    console.log('ERROR: Missing month or year in /history query params');
                    return [2 /*return*/, res.status(400).json({ error: 'Month and year are required' })];
                }
                cacheKey = "".concat(month, "-").concat(year, "-").concat(header.apikey);
                cached = historyCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < TTL) {
                    console.log('History cache hit');
                    return [2 /*return*/, res.status(200).json(cached.data)];
                }
                console.log('History cache miss or expired');
                URL_2 = "https://odoo.entrade.com.vn/hr/get_employee_attendances";
                body = {
                    params: {
                        month: parseInt(month),
                        year: parseInt(year),
                    }
                };
                return [4 /*yield*/, axios_1.default.post(URL_2, body, { headers: header })];
            case 1:
                response = _b.sent();
                historyCache.set(cacheKey, {
                    data: response.data,
                    timestamp: Date.now()
                });
                console.log('Stored in history cache with key:', cacheKey);
                res.status(response.status).json(response.data);
                return [3 /*break*/, 3];
            case 2:
                err_3 = _b.sent();
                console.error('ERROR in /history:', err_3.message);
                res.status(err_3.message.includes('headers are required') ? 400 : 500).json({ error: err_3.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Endpoint 4: GET /my-info
// Headers: api-key, session-id
app.get('/my-info', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var header, cacheKey, cached, URL_3, response, err_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                header = getHeaders(req);
                cacheKey = "my-info-".concat(header.apikey);
                cached = myinfoCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < TTL) {
                    console.log('My-info cache hit');
                    return [2 /*return*/, res.status(200).json(cached.data)];
                }
                console.log('My-info cache miss or expired');
                URL_3 = "https://odoo.entrade.com.vn/hr/get_employee_infor";
                return [4 /*yield*/, axios_1.default.post(URL_3, {}, { headers: header })];
            case 1:
                response = _a.sent();
                myinfoCache.set(cacheKey, {
                    data: response.data,
                    timestamp: Date.now()
                });
                console.log('Stored in my-info cache with key:', cacheKey);
                res.status(response.status).json(response.data);
                return [3 /*break*/, 3];
            case 2:
                err_4 = _a.sent();
                console.error('ERROR in /my-info:', err_4.message);
                res.status(err_4.message.includes('headers are required') ? 400 : 500).json({ error: err_4.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Khởi động server
app.listen(port, function () {
    console.log("Server running at http://localhost:".concat(port));
});
