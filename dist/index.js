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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const convert = require("heic-convert");
// Khởi tạo express app
const app = (0, express_1.default)();
const port = 3001;
// Middleware để parse JSON body và enable CORS
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Cấu hình multer để xử lý file upload
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Cache cho endpoint /history và /my-info
const historyCache = new Map();
const myinfoCache = new Map();
const TTL = 5 * 60 * 1000; // 5 phút (TTL tính bằng milliseconds)
// Hàm convert image buffer sang base64 (hỗ trợ JPG, JPEG, HEIC)
const imageToBase64 = (file) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let buffer = file.buffer;
        // Nếu là HEIC, convert sang JPEG trước
        if (file.mimetype === 'image/heic') {
            console.log('Converting HEIC to JPEG');
            buffer = yield convert({
                buffer: file.buffer,
                format: 'JPEG',
                quality: 1
            });
        }
        return buffer.toString('base64');
    }
    catch (err) {
        console.error('ERROR in imageToBase64:', err.message);
        throw new Error('Failed to convert image to base64');
    }
});
// Hàm tạo headers với apiKey và sessionId từ request headers
const getHeaders = (req) => {
    const apiKey = req.headers['api-key'];
    const sessionId = req.headers['session-id'];
    if (!apiKey || !sessionId) {
        console.log('ERROR: Missing apiKey or sessionId in headers', { apiKey, sessionId });
        throw new Error('apiKey and sessionId headers are required');
    }
    return {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "apikey": apiKey,
        "Connection": "keep-alive",
        "Cookie": `cids=2; session_id=${sessionId}`,
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "EnERP/5 CFNetwork/3826.500.131 Darwin/24.5.0"
    };
};
// Endpoint 1: GET / (for testing)
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Hello World' });
});
// Endpoint 2: POST /check-in
// Request body: multipart/form-data with 'image' field (JPG, JPEG, HEIC)
// Headers: api-key, session-id
app.post('/check-in', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const header = getHeaders(req);
        if (!req.file) {
            console.log('ERROR: Missing image file in /check-in request');
            return res.status(400).json({ error: 'Image file is required' });
        }
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/heic'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            console.log('ERROR: Unsupported image format', { mimetype: req.file.mimetype });
            return res.status(400).json({ error: 'Only JPG, JPEG, and HEIC formats are supported' });
        }
        const base64Image = yield imageToBase64(req.file);
        const URL = "https://odoo.entrade.com.vn/hr/check_in";
        const body = { params: { image: base64Image } };
        const response = yield axios_1.default.post(URL, body, { headers: header });
        // Xóa cache sau khi check-in thành công
        console.log('Clearing caches due to successful check-in');
        historyCache.clear();
        myinfoCache.clear();
        res.status(response.status).json(response.data);
    }
    catch (err) {
        console.error('ERROR in /check-in:', err.message);
        res.status(err.message.includes('headers are required') || err.message.includes('image') ? 400 : 500).json({ error: err.message });
    }
}));
// Endpoint 3: GET /history
// Query params: ?month=10&year=2025
// Headers: api-key, session-id
app.get('/history', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const header = getHeaders(req);
        const { month, year } = req.query;
        if (!month || !year) {
            console.log('ERROR: Missing month or year in /history query params');
            return res.status(400).json({ error: 'Month and year are required' });
        }
        const cacheKey = `${month}-${year}-${header.apikey}`;
        const cached = historyCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < TTL) {
            console.log('History cache hit');
            return res.status(200).json(cached.data);
        }
        console.log('History cache miss or expired');
        const URL = "https://odoo.entrade.com.vn/hr/get_employee_attendances";
        const body = {
            params: {
                month: parseInt(month),
                year: parseInt(year),
            }
        };
        const response = yield axios_1.default.post(URL, body, { headers: header });
        historyCache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log('Stored in history cache with key:', cacheKey);
        res.status(response.status).json(response.data);
    }
    catch (err) {
        console.error('ERROR in /history:', err.message);
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
}));
// Endpoint 4: GET /my-info
// Headers: api-key, session-id
app.get('/my-info', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const header = getHeaders(req);
        const cacheKey = `my-info-${header.apikey}`;
        const cached = myinfoCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < TTL) {
            console.log('My-info cache hit');
            return res.status(200).json(cached.data);
        }
        console.log('My-info cache miss or expired');
        const URL = "https://odoo.entrade.com.vn/hr/get_employee_infor";
        const response = yield axios_1.default.post(URL, {}, { headers: header });
        myinfoCache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log('Stored in my-info cache with key:', cacheKey);
        res.status(response.status).json(response.data);
    }
    catch (err) {
        console.error('ERROR in /my-info:', err.message);
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
}));
// Khởi động server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
