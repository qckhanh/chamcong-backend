import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const port = 3001;

// Middleware để parse JSON body và enable CORS
app.use(express.json());
app.use(cors());

// Biến lưu trữ API_KEY và SESSION_ID
let API_KEY: string | null = "3a4f42536960e3f1406add9c81933ad9135d106e";
let SESSION_ID: string | null = "3ce850d2348c6ada442bb0a841b779de165caf79";

// Cache cho endpoint /history
const historyCache = new Map<string, { data: any; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 phút (TTL tính bằng milliseconds)

// Hàm tạo headers với API_KEY và SESSION_ID hiện tại
const getHeaders = () => {
    if (!API_KEY || !SESSION_ID) {
        console.log('ERROR: API_KEY or SESSION_ID not set');
        throw new Error('API_KEY and SESSION_ID must be set up first');
    }
    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "apikey": API_KEY,
        "Connection": "keep-alive",
        "Cookie": `cids=2; session_id=${SESSION_ID}`,
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "EnERP/5 CFNetwork/3826.500.131 Darwin/24.5.0"
    };
    console.log('Headers generated:', headers);
    return headers;
};

// Endpoint 1: POST /setup
// Request body: { apiKey: string, sessionId: string }
app.post('/setup', (req: Request, res: Response) => {
    console.log('Received POST /setup request with body:', req.body);
    try {
        const { apiKey, sessionId } = req.body;
        if (!apiKey || !sessionId) {
            console.log('ERROR: Missing apiKey or sessionId in request body');
            return res.status(400).json({ error: 'apiKey and sessionId are required' });
        }

        API_KEY = apiKey;
        SESSION_ID = sessionId;
        console.log('Updated API_KEY:', API_KEY);
        console.log('Updated SESSION_ID:', SESSION_ID);
        res.status(200).json({ message: 'API_KEY and SESSION_ID updated successfully' });
        console.log('Sent response for /setup:', { message: 'API_KEY and SESSION_ID updated successfully' });
    } catch (err: any) {
        console.error('ERROR in /setup:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint 2: POST /check-in
// Request body: { image: string (base64) }
app.post('/check-in', async (req: Request, res: Response) => {
    console.log('Received POST /check-in request with body:', req.body);
    try {
        if (!API_KEY || !SESSION_ID) {
            console.log('ERROR: API_KEY or SESSION_ID not set for /check-in');
            return res.status(403).json({ error: 'API_KEY and SESSION_ID must be set up first' });
        }

        const { image } = req.body;
        if (!image) {
            console.log('ERROR: Image base64 is missing in /check-in request');
            return res.status(400).json({ error: 'Image base64 is required' });
        }

        const URL = "https://odoo.entrade.com.vn/hr/check_in";
        const body = {
            params: {
                image: image
            }
        };
        console.log('Sending POST request to:', URL);
        console.log('Request body:', body);

        const response = await axios.post(URL, body, { headers: getHeaders() });
        console.log('Received response from check-in API:', {
            status: response.status,
            data: response.data
        });

        // Xóa cache sau khi check-in thành công
        console.log('Clearing history cache due to successful check-in');
        historyCache.clear();
        console.log('Cache after clear:', historyCache);

        res.status(response.status).json(response.data);
        console.log('Sent response for /check-in:', response.data);
    } catch (err: any) {
        console.error('ERROR in /check-in:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint 3: GET /history
// Query params: ?month=10&year=2025
app.get('/history', async (req: Request, res: Response) => {
    console.log('Received GET /history request with query:', req.query);
    try {
        if (!API_KEY || !SESSION_ID) {
            console.log('ERROR: API_KEY or SESSION_ID not set for /history');
            return res.status(403).json({ error: 'API_KEY and SESSION_ID must be set up first' });
        }

        const { month, year } = req.query;
        if (!month || !year) {
            console.log('ERROR: Missing month or year in /history query params');
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const cacheKey = `${month}-${year}`;
        const cached = historyCache.get(cacheKey);
        console.log('Checking cache for key:', cacheKey);

        // Kiểm tra cache và TTL
        if (cached && Date.now() - cached.timestamp < TTL) {
            console.log('Cache hit! Returning cached data:', cached.data);
            return res.status(200).json(cached.data);
        }
        console.log('Cache miss or expired for key:', cacheKey);

        const URL = "https://odoo.entrade.com.vn/hr/get_employee_attendances";
        const body = {
            params: {
                "month": parseInt(month as string),
                "year": parseInt(year as string),
            }
        };
        console.log('Sending POST request to:', URL);
        console.log('Request body:', body);

        const response = await axios.post(URL, body, { headers: getHeaders() });
        console.log('Received response from history API:', {
            status: response.status,
            data: response.data
        });

        // Lưu vào cache với timestamp
        historyCache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log('Stored in cache with key:', cacheKey);
        console.log('Current cache state:', historyCache);

        res.status(response.status).json(response.data);
        console.log('Sent response for /history:', response.data);
    } catch (err: any) {
        console.error('ERROR in /history:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});