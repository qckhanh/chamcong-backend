import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const port = 3001;

// Middleware để parse JSON body và enable CORS
app.use(express.json());
app.use(cors());

// Cache cho endpoint /history và /my-info
const historyCache = new Map<string, { data: any; timestamp: number }>();
const myinfoCache = new Map<string, { data: any; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 phút (TTL tính bằng milliseconds)

// Hàm tạo headers với apiKey và sessionId từ request headers
const getHeaders = (req: Request) => {
    const apiKey = req.headers['api-key'] as string;
    const sessionId = req.headers['session-id'] as string;

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
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Hello World' });
});

// Endpoint 2: POST /check-in
// Request body: { image: string (base64) }
// Headers: api-key, session-id
app.post('/check-in', async (req: Request, res: Response) => {
    try {
        const header = getHeaders(req);
        const { image } = req.body;
        if (!image) {
            console.log('ERROR: Missing image in /check-in request');
            return res.status(400).json({ error: 'Image base64 is required' });
        }

        const URL = "https://odoo.entrade.com.vn/hr/check_in";
        const body = { params: { image } };
        const response = await axios.post(URL, body, { headers: header });

        // Xóa cache sau khi check-in thành công
        console.log('Clearing caches due to successful check-in');
        historyCache.clear();
        myinfoCache.clear();

        res.status(response.status).json(response.data);
    } catch (err: any) {
        console.error('ERROR in /check-in:', err.message);
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
});

// Endpoint 3: GET /history
// Query params: ?month=10&year=2025
// Headers: api-key, session-id
app.get('/history', async (req: Request, res: Response) => {
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
                month: parseInt(month as string),
                year: parseInt(year as string),
            }
        };
        const response = await axios.post(URL, body, { headers: header });

        historyCache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log('Stored in history cache with key:', cacheKey);

        res.status(response.status).json(response.data);
    } catch (err: any) {
        console.error('ERROR in /history:', err.message);
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
});

// Endpoint 4: GET /my-info
// Headers: api-key, session-id
app.get('/my-info', async (req: Request, res: Response) => {
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
        const response = await axios.post(URL, {}, { headers: header });

        myinfoCache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log('Stored in my-info cache with key:', cacheKey);

        res.status(response.status).json(response.data);
    } catch (err: any) {
        console.error('ERROR in /my-info:', err.message);
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});