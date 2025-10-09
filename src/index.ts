import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const port = 3001;

// Middleware để parse JSON body và enable CORS
app.use(express.json());
app.use(cors());

// Cache cho endpoint /history
const historyCache = new Map<string, { data: any; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 phút (TTL tính bằng milliseconds)

// Hàm tạo headers với apiKey và sessionId từ request headers
const getHeaders = (req: Request) => {
    const apiKey = req.headers['api-key'] as string;
    const sessionId = req.headers['session-id'] as string;

    if (!apiKey || !sessionId) {
        console.log('ERROR: apiKey or sessionId missing in headers', { apiKey, sessionId });
        throw new Error('apiKey and sessionId headers are required');
    }

    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "apikey": apiKey,
        "Connection": "keep-alive",
        "Cookie": `cids=2; session_id=${sessionId}`,
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "EnERP/5 CFNetwork/3826.500.131 Darwin/24.5.0"
    };
    console.log('Headers generated:', headers);
    return headers;
};

// Endpoint 1: GET / (for testing)
app.get('/', (req: Request, res: Response) => {
    console.log('Received GET / request');
    res.status(200).json({ message: 'Hello World' });
    console.log('Sent response for /:', { message: 'Hello World' });
});

// Endpoint 2: POST /check-in
// Request body: { image: string (base64) }
// Headers: apiKey, sessionId
app.post('/check-in', async (req: Request, res: Response) => {
    console.log('Received POST /check-in request with body:', req.body);
    console.log('Request headers:', req.headers);
    try {
        const header = getHeaders(req); // Kiểm tra headers trước
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

        const response = await axios.post(URL, body, { headers: header });
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
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
});

// Endpoint 4: GET /my-info
// Headers: apiKey, sessionId
app.get('/my-info', async (req: Request, res: Response) => {
    console.log('Received GET /my-info request');
    console.log('Request headers:', req.headers);
    try {
        const header = getHeaders(req); // Kiểm tra headers trước
        const URL = "https://odoo.entrade.com.vn/hr/get_employee_infor";
        console.log('Sending GET request to:', URL);

        const response = await axios.post(URL, { headers: header });
        console.log('Received response from get_employee_infor API:', {
            status: response.status,
            data: response.data
        });

        res.status(response.status).json(response.data);
        console.log('Sent response for /my-info:', response.data);
    } catch (err: any) {
        console.error('ERROR in /my-info:', err.message);
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
});

// Endpoint 3: GET /history
// Query params: ?month=10&year=2025
// Headers: apiKey, sessionId
app.get('/history', async (req: Request, res: Response) => {
    console.log('Received GET /history request with query:', req.query);
    console.log('Request headers:', req.headers);
    try {
        const header = getHeaders(req); // Kiểm tra headers trước
        const { month, year } = req.query;
        if (!month || !year) {
            console.log('ERROR: Missing month or year in /history query params');
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const cacheKey = `${month}-${year}-${header.apikey}`;
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

        const response = await axios.post(URL, body, { headers: header });
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
        res.status(err.message.includes('headers are required') ? 400 : 500).json({ error: err.message });
    }
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});